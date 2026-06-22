# Goal highlights

Matchscore lets clubs paste a **public Veo match URL** and compile all goal clips into one highlight video. Users can preview and download the result, draft a social caption, and toggle posting channels — actual Meta posting is **not wired yet**.

This feature is separate from **Automations** (no template editor). It reuses the same social channel UI patterns and `postingChannels` shape as `organizationAutomations`.

**Veo API details:** [veo-api-research.md](./veo-api-research.md)  
**Video storage (R2):** [goal-highlights-r2-storage.md](./goal-highlights-r2-storage.md)  
**Video processing:** [Very Good FFmpeg](https://verygoodffmpeg.com/docs) (external service; no ffmpeg binary on Convex)

---

## Product scope (MVP)

| In scope | Out of scope (deferred) |
| --- | --- |
| Paste public Veo URL → compile goals → preview + download | Posting to Facebook/Instagram |
| Job history per organisation | Linking jobs to calendar `matches` rows |
| Social compose shell (caption + channel toggles) | Pre-filled caption from match metadata |
| Regenerate after failure or video expiry | VGF webhook HMAC signing |
| Manual delete (list + job workspace) | Rate limiting per org |
| 90-day video retention (DB records kept) | |

---

## User-facing flows

### Routes

| Route | Purpose |
| --- | --- |
| `/app/goal-highlights` | URL input, generate button, job history |
| `/app/goal-highlights/[jobId]` | Job workspace: video, compose, delete, regenerate |

Nav item: **Goal highlights** (`Video` icon), between Automations and Connected Socials. i18n key: `app.shell.nav.goalHighlights`.

### Generate a compilation

1. User pastes a Veo match URL and clicks **Generate**.
2. Client calls `api.veoPosts.actions.createOrOpenJob`.
3. On success, navigates to the job workspace. Status is reactive via `useQuery(getJob)`.
4. On validation error, a translated Sonner toast is shown and **no job row is created**.

### Job workspace

Top to bottom:

1. **Header** — back link, match title, status badge, delete button.
2. **Video area** — processing skeleton, `<video>` + download when ready, expired/failed states with regenerate.
3. **Match meta** — score, goal count, expiry date, score-mismatch warning when applicable.
4. **Compose section** — caption (autosave), Facebook/Instagram channel toggles, **Post to social** stub.

**Post to social:** enabled only when `status === "ready"` and a stored video exists. Click shows a “coming soon” toast.

**Download:** fetches the signed R2 URL as a blob and triggers a same-origin object-URL download (required because cross-origin `download` attributes are ignored by browsers).

### Dedupe (same Veo URL)

Lookup key: `(organizationId, veoMatchSlug)`.

| Existing job | Action |
| --- | --- |
| `processing` / `pending` / `fetching` | Open same job silently (no toast) |
| `ready` + stored video + `expiresAt > now` | Open same job; toast “Opening existing compilation…” |
| `ready` without stored video (expired) | Open same job; user can **Regenerate video** |
| `failed` | Open same job; user can **Regenerate video** |
| None | Create new job and run pipeline |

Re-submitting the same URL never creates duplicate rows when a reusable job already exists.

### Delete

- **Job workspace** or **history list** (trash icon) → confirmation dialog.
- Deletes the R2 object (if any) and the `veoPostJobs` row.

### Regenerate

- Available when status is `failed`, or `ready` but the stored video was removed (expired).
- Re-validates the match against Veo, updates goal metadata on the **same row**, and submits a new VGF job.

---

## Architecture

```text
┌──────────┐    ┌─────────────────────────┐    ┌──────────────────┐
│ Next.js  │───▶│ createOrOpenJob         │───▶│ Veo web API      │
│ UI       │    │ regenerateJob (actions) │    │ (public match)   │
└──────────┘    └───────────┬─────────────┘    └──────────────────┘
                            │ validate before insert; dedupe first
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
                            │ schedule handleVgfWebhook
                            ▼
                ┌───────────────────────┐
                │ downloadVgfOutputToR2 │
                │ VGF output → R2       │
                │ → markReady           │
                └───────────┬───────────┘
                            ▼
                ┌───────────────────────┐    ┌──────────────────┐
                │ UI (useQuery getJob)  │───▶│ Cloudflare R2    │
                │ signed outputVideoUrl   │    │ (playback/CDN)   │
                └───────────────────────┘    └──────────────────┘
```

**Principles:**

- Convex orchestrates only. Goal clip bytes never pass through mutations.
- Individual goal clips are **never** stored in Convex — only the final compiled MP4 (in **Cloudflare R2** via `@convex-dev/r2`).
- VGF downloads goal clips directly from Veo CDN URLs supplied at submit time.
- Webhook handler returns `200` immediately; heavy work runs in an internal action.
- Browser playback/download uses **signed R2 URLs** from `getJob`, not Convex file storage (see [goal-highlights-r2-storage.md](./goal-highlights-r2-storage.md)).

**Polling fallback:** 10 minutes after VGF submit, `pollVgfJobIfPending` checks job status if the webhook was missed.

---

## Goal selection rules

Implemented in `convex/veoPosts/helpers.ts`:

- Include highlights where any tag matches `slug === "goal"` or `slug.endsWith("-goal")` (e.g. `penalty-goal`, `own-goal`).
- **Exclude** `shot-on-goal`.
- Exclude highlights with `should_render === false` or missing `videos[0].url`.
- Sort by `start` ascending before concat.
- **Maximum 15 goals** per job (`MAX_GOALS_PER_JOB`).

Score mismatch (Veo scoreline vs detected goal count) does **not** block compilation. A `warningMessage` is stored and shown inline on the job workspace.

---

## Data model

### `veoPostJobs`

One row per compilation job, scoped to an organisation.

| Field | Description |
| --- | --- |
| `organizationId`, `createdByUserId` | Ownership |
| `veoMatchSlug`, `veoMatchUrl` | Input link (slug used for dedupe) |
| `veoMatchTitle`, `veoClubName`, `veoOpponentName` | Denormalized match metadata for list UI |
| `veoScoreOwn`, `veoScoreOpponent` | Scoreline from Veo |
| `draftCaption` | User-editable post caption (max 2200 chars) |
| `postingChannels` | Same shape as `organizationAutomations.postingChannels`; defaults all channels enabled |
| `status` | `pending` \| `fetching` \| `processing` \| `ready` \| `failed` (create/regenerate use `processing`) |
| `goalCount`, `goalStartsSeconds`, `goalHighlightIds` | Audit of included goals |
| `warningMessage` | Score mismatch warning text |
| `vgffmpegJobId` | Correlation id for VGF webhook validation |
| `outputR2Key`, `outputByteSize`, `outputDurationSeconds` | Compiled MP4 in Cloudflare R2 |
| `errorMessage`, `failedAt` | Failure details |
| `createdAt`, `completedAt`, `expiresAt` | Timestamps; `expiresAt = completedAt + 90 days` when ready |

**Indexes:** `by_organizationId`, `by_organizationId_and_createdAt`, `by_organizationId_and_veoMatchSlug`, `by_vgffmpegJobId`, `by_expiresAt`.

### Query-derived flags

`getJob` and `listJobs` expose:

| Flag | Meaning |
| --- | --- |
| `hasVideo` | `outputR2Key` is set |
| `videoExpired` | `status === "ready"`, `completedAt` set, but no `outputR2Key` (cron removed the object) |

---

## Storage & retention

### What we store

| Stored | Not stored |
| --- | --- |
| One compiled MP4 per successful job (`outputR2Key` in Cloudflare R2) | Individual goal clip MP4s |
| Job metadata (~2 KB) | Raw Veo JSON, per-goal CDN URLs, webhook bodies |
| | VGF intermediate files |

Typical compiled output: ~45 MB.

### 90-day video expiry

When a job reaches `ready`, `expiresAt` is set to 90 days after `completedAt`.

Daily cron (`convex/crons.ts`, 03:00 UTC) runs `expireStoredVideos`:

1. Query jobs where `expiresAt < now` (index `by_expiresAt`).
2. If `outputR2Key` exists → delete R2 object, clear `outputR2Key` / size / duration fields.
3. **Keep the job row** (caption, channels, history metadata remain).

Users can **Regenerate video** on expired jobs or delete the record manually.

Full R2 setup, CORS, env vars, and migration steps: [goal-highlights-r2-storage.md](./goal-highlights-r2-storage.md).

---

## Very Good FFmpeg integration

Client: `@verygoodffmpeg/sdk` in `convex/veoPosts/vgfClient.ts`.

### Submit

- **Input:** Veo CDN URLs as `goal1.mp4`, `goal2.mp4`, …
- **Command:** concat filter for multiple goals; single-goal jobs use a simpler transcode command (`convex/veoPosts/vgfHelpers.ts`).
- **Webhook URL:** `{CONVEX_SITE_URL}/webhooks/vgffmpeg?jobId={veoPostJobId}`
- **Machine:** `cpu`

### Webhook

Route: `POST /webhooks/vgffmpeg` in `convex/http.ts`.

1. Parse `jobId` query param and JSON body.
2. Schedule `internal.veoPosts.internalActions.handleVgfWebhook`.
3. Validate `vgffmpegJobId` matches the stored job (when present).
4. Idempotent: skip if already `ready` with a stored video.
5. On success: `downloadVgfOutputToR2` (stream or blob upload to R2) → `markReady`.
6. On failure: `markFailed`.

Ingest details (size cap, streaming vs blob fallback): [goal-highlights-r2-storage.md](./goal-highlights-r2-storage.md#ingest-pipeline-downloadvgfoutputtor2ts).

VGF output URLs are signed and short-lived; we copy to Cloudflare R2 promptly and never link the UI to VGF URLs long-term.

---

## Convex backend

Folder: `convex/veoPosts/` — see [convex-structure.md](./convex-structure.md).

### Public API

| Function | Type | Purpose |
| --- | --- | --- |
| `queries.listJobs` | query | Org job history (newest first) |
| `queries.getJob` | query | Job detail + signed `outputVideoUrl` |
| `mutations.updateDraftCaption` | mutation | Save caption draft |
| `mutations.setPostingChannelEnabled` | mutation | Toggle one posting channel |
| `mutations.deleteJob` | mutation | Delete R2 object + row |
| `actions.createOrOpenJob` | action | Validate Veo, dedupe, insert, start VGF |
| `actions.regenerateJob` | action | Re-validate Veo, reset row, start VGF |

### Internal functions

| Function | Purpose |
| --- | --- |
| `internalQueries.getCreateOrOpenPlan` | Auth + URL parse + dedupe decision |
| `internalQueries.getJobForRegeneration` | Auth-scoped job lookup for regenerate |
| `internalQueries.getJobForProcessing` | Webhook/poll status checks |
| `internalMutations.insertProcessingJob` | Create row after Veo validation |
| `internalMutations.attachVgfJobId` | Store VGF correlation id |
| `internalMutations.markReady` / `markFailed` | Terminal pipeline states |
| `internalMutations.resetJobForRegeneration` | Clear output + reset to processing |
| `internalMutations.expireStoredVideos` | Cron: delete expired R2 objects |
| `internalMutations.clearLegacyConvexHighlightVideos` | One-time: delete pre-R2 Convex storage blobs |
| `internalActions.handleVgfWebhook` | Process VGF completion |
| `internalActions.pollVgfJobIfPending` | Webhook fallback |

### Shared helpers

| Path | Role |
| --- | --- |
| `convex/veoPosts/helpers.ts` | Veo fetch, goal filter, validation, dedupe |
| `convex/veoPosts/vgfHelpers.ts` | FFmpeg command builder, webhook URL, payload normalization |
| `convex/veoPosts/downloadVgfOutputToR2.ts` | Stream remote MP4 into Cloudflare R2 |
| `convex/veoPosts/r2Client.ts` | `@convex-dev/r2` client + object key helpers |
| `convex/veoPosts/access.ts` | Org-scoped job access |
| `lib/goal-highlights/errors.ts` | Structured error codes for client toasts |
| `lib/goal-highlights/get-error-message.ts` | Map codes → i18n |
| `lib/goal-highlights/constants.ts` | `MAX_DRAFT_CAPTION_LENGTH` (2200) |

---

## Frontend

| Path | Role |
| --- | --- |
| `app/app/goal-highlights/page.tsx` | List + generate |
| `app/app/goal-highlights/[jobId]/page.tsx` | Job workspace |
| `components/goal-highlights/job-video-area.tsx` | Video player, download, expired/failed states |
| `components/goal-highlights/job-compose-section.tsx` | Caption autosave + channels + post stub |
| `components/goal-highlights/job-history-list.tsx` | History with delete |
| `components/goal-highlights/delete-job-dialog.tsx` | Delete confirmation |
| `components/goal-highlights/job-status-badge.tsx` | Status chip |
| `components/automations/posting-channel-block.tsx` | Shared Facebook/Instagram toggles |
| `hooks/use-compose-autosave.ts` | 2 s debounced caption save |

Caption autosave shows **Saving…** / **Saved** / **Unsaved changes** indicators (same pattern as the template editor).

User feedback uses Sonner via `@/lib/user-feedback`. i18n namespace: `app.goalHighlights`.

---

## Error handling

Validation errors (before a job row exists) throw `ConvexError` with structured data from `lib/goal-highlights/errors.ts`. The client maps codes to translated toasts.

| Scenario | User feedback | DB |
| --- | --- | --- |
| Invalid URL | Toast | No row |
| Private / 404 match | Toast | No row |
| No goals | Toast | No row |
| > 15 goals | Toast | No row |
| Clip not ready | Toast | No row |
| Veo fetch error | Toast | No row |
| VGF / download failure | Failed status + toast | Row kept (`failed`) |
| Score mismatch | Inline warning | Row created; compilation proceeds |
| Duplicate webhook | — | No-op if already ready with video |

---

## Environment variables

See [goal-highlights-r2-storage.md](./goal-highlights-r2-storage.md#setup-checklist) for the full R2 setup checklist.

Set on the **Convex deployment** (not Next.js public env):

```bash
npx convex env set VGFFMPEG_API_KEY "..."
npx convex env set R2_BUCKET "your-bucket-name"
npx convex env set R2_ENDPOINT "https://<account_id>.r2.cloudflarestorage.com"
npx convex env set R2_ACCESS_KEY_ID "..."
npx convex env set R2_SECRET_ACCESS_KEY "..."
```

Configure R2 bucket CORS to allow `GET` and `HEAD` from `http://localhost:3000` and your production `SITE_URL`.

One-time migration from Convex file storage:

```bash
npx convex run veoPosts/internalMutations:clearLegacyConvexHighlightVideos
```

Webhook base URL is resolved automatically in `convex/veoPosts/convexSiteUrl.ts` from, in order:

1. `CONVEX_SITE_URL`
2. `NEXT_PUBLIC_CONVEX_SITE_URL`
3. `CONVEX_CLOUD_URL` with `.convex.cloud` → `.convex.site`

See `.env.example` for local reference.

---

## Access control

Any organisation member can list, view, compose, delete, and regenerate jobs for their org. All queries and mutations derive the organisation from authenticated membership — never from client-supplied org ids.

The VGF webhook endpoint is public. Mitigation: webhook URL includes unguessable Convex job id; handler validates `vgffmpegJobId` correlation.

Goal clip URLs come only from server-side Veo fetches, never from client input.

---

## Testing

### Automated

```bash
pnpm test convex/veoPosts/helpers.test.ts
pnpm test convex/veoPosts/vgfHelpers.test.ts
pnpm test convex/veoPosts/downloadVgfOutputToR2.test.ts
```

Covers URL parsing, goal tag filter, dedupe logic, score-mismatch warning, and VGF command builder.

### Manual checklist

1. Public Veo URL → video compiles and plays.
2. Same URL while ready → reopens cached job with toast.
3. Same URL while processing → reopens silently.
4. Invalid / private URL → toast, no history row.
5. Caption + channel toggles persist after refresh.
6. Post button disabled until video ready; stub toast when clicked.
7. Download saves `.mp4` locally (not in-browser navigation).
8. Delete from list and workspace.
9. Regenerate after failure or simulated expiry.
10. Cron: patch `expiresAt` to the past, run `npx convex run veoPosts/internalMutations:expireStoredVideos` — R2 object gone, row kept, regenerate works.

---

## Job lifecycle

```text
                    createOrOpenJob / regenerateJob
                              │
                              ▼
                       processing ──VGF fail──▶ failed
                              │                    │
                              │                    └── regenerate ──▶ processing
                              ▼
                           ready ◀── webhook success
                              │
              ┌───────────────┴───────────────┐
              │                               │
     expireStoredVideos (90d)          deleteJob
              │                               │
              ▼                               ▼
    ready + videoExpired                  (row deleted)
    (no outputR2Key)
              │
              └── regenerate ──▶ processing
```

---

## Deferred (post-MVP)

| Area | Notes |
| --- | --- |
| Wire **Post to social** | Meta APIs, use `draftCaption` + `postingChannels` on job row |
| Link job to calendar match | Optional `matchId` foreign key |
| Default caption from match data | e.g. score line + club names |
| Org-level default posting channels | Currently all channels default to enabled |
| VGF webhook signing | Confirm whether VGF supports HMAC; add secret token if not |
| Audio-less goal clips | Concat filter assumes audio streams; may need ffmpeg fallback |
| Rate limiting | Per-org job creation caps |
| `pnpm test:veo-api` | Integration script against live Veo |

---

## Related documentation

- [goal-highlights-r2-storage.md](./goal-highlights-r2-storage.md) — R2 migration, setup, ingest, costs
- [veo-api-research.md](./veo-api-research.md) — Veo endpoints, response shapes, sample payloads
- [automations-and-templates.md](./automations-and-templates.md) — Shared `postingChannels` model
- [convex-structure.md](./convex-structure.md) — Convex folder conventions
- [Very Good FFmpeg docs](https://verygoodffmpeg.com/docs) — Job submission, webhooks, billing
