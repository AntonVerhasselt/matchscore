# Goal highlights — Cloudflare R2 storage

Compiled goal highlight videos are stored in **Cloudflare R2**, not Convex built-in file storage. Convex still orchestrates the pipeline (Veo validation, VGF jobs, webhooks, job state, auth). Only the **final MP4 bytes** live in R2.

**Feature overview:** [goal-highlights.md](./goal-highlights.md)

---

## Why we moved off Convex storage

Goal highlight outputs are large (~45 MB per compilation). When videos were stored in Convex and served via `ctx.storage.getUrl()`:

| Convex free-tier limit | Problem |
| --- | --- |
| **File storage (1 GB)** | ~15 compiles ≈ 650 MB consumed quickly |
| **Data egress (1 GB/month)** | Every preview, replay, and download counted as **Serving reads** (~844 MB in one day of testing) |

R2 fixes both for this feature:

- **Storage** moves to R2 (10 GB/month free on Standard storage).
- **Playback and download** go **R2 → browser** via signed URLs, not Convex → browser.
- **Egress from R2 to the internet is free.**

Convex still pays **fetch egress** when the webhook action downloads VGF output and uploads to R2 (~45 MB per successful compile). That is much smaller than serving video to users repeatedly.

Other app media (template assets, automation thumbnails, team logos) **remain on Convex storage** — only goal highlights use R2.

---

## Architecture

```text
┌──────────┐    ┌─────────────────────────┐    ┌──────────────────┐
│ Next.js  │───▶│ createOrOpenJob         │───▶│ Veo web API      │
│ UI       │    │ regenerateJob (actions) │    │ (public match)   │
└──────────┘    └───────────┬─────────────┘    └──────────────────┘
                            │
                            ▼
                ┌───────────────────────┐    ┌──────────────────┐
                │ veoPostJobs row       │───▶│ Very Good FFmpeg │
                │ status: processing    │    │ (concat + encode)│
                └───────────┬───────────┘    └────────┬─────────┘
                            │                           │
                            │              webhook POST │
                            ▼                           ▼
                ┌───────────────────────┐    ┌──────────────────┐
                │ POST /webhooks/vgffmpeg│◀───│ VGF worker       │
                └───────────┬───────────┘    └──────────────────┘
                            │ handleVgfWebhook (internal action)
                            ▼
                ┌───────────────────────┐
                │ downloadVgfOutputToR2 │
                │ VGF URL → R2 PUT      │
                │ markReady(outputR2Key)│
                └───────────┬───────────┘
                            ▼
                ┌───────────────────────┐    ┌──────────────────┐
                │ getJob query          │───▶│ Cloudflare R2    │
                │ signed outputVideoUrl │    │ (object storage) │
                └───────────┬───────────┘    └────────┬─────────┘
                            │                           │
                            ▼                           │
                ┌───────────────────────┐             │
                │ <video> + download      │◀────────────┘
                └───────────────────────┘
```

### Component

We use the official Convex component [`@convex-dev/r2`](https://www.convex.dev/components/cloudflare-r2), registered in `convex/convex.config.ts` alongside Better Auth, Resend, and Stripe.

Scoped client: `convex/veoPosts/r2Client.ts` — only the goal highlights feature imports this module.

---

## Data model

| Field | Type | Purpose |
| --- | --- | --- |
| `outputR2Key` | `string?` | R2 object key, e.g. `goal-highlights/{jobId}.mp4` |
| `outputByteSize` | `number?` | Size metadata |
| `outputDurationSeconds` | `number?` | Optional duration (reserved; not set by current webhook path) |

`getJob` returns a **signed R2 URL** as `outputVideoUrl` (not stored in the DB). Default URL lifetime: **24 hours** (`GOAL_HIGHLIGHT_URL_EXPIRES_SECONDS` in `r2Client.ts`; component max is 7 days).

Query-derived flags:

| Flag | Condition |
| --- | --- |
| `hasVideo` | `outputR2Key` is set |
| `videoExpired` | `status === "ready"`, `completedAt` set, `outputR2Key` cleared by cron |

---

## Ingest pipeline (`downloadVgfOutputToR2.ts`)

After VGF succeeds, `handleVgfWebhook` calls `downloadVgfOutputToR2`:

1. **Fetch** compiled MP4 from VGF signed output URL.
2. **Validate size** — max **200 MB** (`MAX_VGF_OUTPUT_BYTES`); checks `Content-Length` and/or VGF `totalOutputBytes`.
3. **Upload to R2:**
   - **Primary:** stream via signed **PUT** to R2 (low memory).
   - **If size unknown:** skip streaming; use **blob fallback** so `blob.size` is checked after download.
   - **If streaming fails:** re-fetch and blob fallback.
4. **`syncMetadata`** — register object in the R2 component metadata table.
5. **`markReady`** — patch `outputR2Key` on `veoPostJobs`.

Object keys are deterministic: `goal-highlights/{veoPostJobId}.mp4`.

---

## Serving and deletion

| Operation | Implementation |
| --- | --- |
| **Play / download** | `goalHighlightsR2.getUrl(outputR2Key)` in `queries.getJob` |
| **Delete job** | `goalHighlightsR2.deleteObject` in `mutations.deleteJob` |
| **Regenerate** | Delete old R2 object in `resetJobForRegeneration`, then re-run pipeline |
| **90-day expiry** | Cron `expireStoredVideos` deletes R2 object, clears key fields, keeps row |

Access control is unchanged: only org members get a URL from `getJob`; the R2 key alone is not exposed to unauthenticated clients.

---

## Setup checklist

### 1. Cloudflare R2

1. Create an R2 bucket (separate dev/prod buckets recommended).
2. Create an API token with **Object Read & Write**, scoped to the bucket.
3. Record **Access Key ID**, **Secret Access Key**, and **Endpoint** (`https://<account_id>.r2.cloudflarestorage.com`).

### 2. CORS (required for browser `<video>` and download)

Add a bucket CORS policy allowing `GET` and `HEAD` from your app origins (no path in `AllowedOrigins`):

```json
[
  {
    "AllowedOrigins": [
      "http://localhost:3000",
      "https://your-production-site.example"
    ],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag", "Content-Length"],
    "MaxAgeSeconds": 3600
  }
]
```

Use the same host as `SITE_URL` / `NEXT_PUBLIC_SITE_URL`.

### 3. Convex environment variables

Set on **each** deployment (dev and prod):

```bash
npx convex env set R2_BUCKET "your-bucket-name"
npx convex env set R2_ENDPOINT "https://<account_id>.r2.cloudflarestorage.com"
npx convex env set R2_ACCESS_KEY_ID "..."
npx convex env set R2_SECRET_ACCESS_KEY "..."
```

Production: add `--prod` to each command.

See also `.env.example` (reference only — values live on the Convex deployment, not in `.env.local`).

### 4. One-time migration from Convex file storage

If jobs were created before R2, delete leftover Convex blobs:

```bash
npx convex run veoPosts/internalMutations:clearLegacyConvexHighlightVideos
```

Returns `{ deletedBlobCount }`. Legacy `outputStorageId` fields on old rows are ignored; those jobs show as **expired** until regenerated.

### 5. Verify

1. Generate a new highlight end-to-end.
2. Confirm object in Cloudflare R2 dashboard at `goal-highlights/{jobId}.mp4`.
3. Confirm video plays and downloads in the job workspace.
4. Confirm Convex **file storage** does not grow for new compiles.
5. Re-play video several times — Convex **data egress** should stay flat.

---

## Cost notes

| Service | Highlights usage |
| --- | --- |
| **Cloudflare R2** | Free tier: 10 GB-month storage, free egress; ~$0.015/GB-month after |
| **Convex** | Job metadata + orchestration; ~45 MB fetch egress per compile |
| **Very Good FFmpeg** | Billed per GB processed (input + output); separate from Convex/R2 |

At typical club volume, R2 stays within the free tier. VGF is the main variable cost as compile volume grows.

---

## What we did not change

- Veo API integration, goal filtering, dedupe, compose UI
- VGF submit/webhook/poll flow
- 90-day retention semantics (DB row kept; R2 object removed)
- Template assets, thumbnails, logos — still Convex `_storage`

---

## Future improvements (not implemented)

| Idea | Benefit |
| --- | --- |
| **Cloudflare Worker ingest** | VGF → R2 without bytes through Convex actions; eliminates compile fetch egress |
| **R2 custom domain** | CDN-cached stable URLs instead of short-lived signed URLs |
| **Shorter retention** | Lower R2 storage if volume grows |

---

## Related files

| Path | Role |
| --- | --- |
| `convex/convex.config.ts` | Registers `@convex-dev/r2` component |
| `convex/veoPosts/r2Client.ts` | R2 client, key prefix, URL expiry |
| `convex/veoPosts/downloadVgfOutputToR2.ts` | VGF → R2 ingest |
| `convex/veoPosts/internalActions.ts` | Webhook → ingest → `markReady` |
| `convex/veoPosts/queries.ts` | Signed playback URLs |
| `convex/veoPosts/internalMutations.ts` | Expiry cron, legacy cleanup |

---

## Related documentation

- [goal-highlights.md](./goal-highlights.md) — product flows, API surface, lifecycle
- [convex-structure.md](./convex-structure.md) — folder layout
- [Convex R2 component](https://www.convex.dev/components/cloudflare-r2)
- [Cloudflare R2 CORS](https://developers.cloudflare.com/r2/buckets/cors/)
- [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/)
