# Goal highlights — implementation plan

> **Status:** Plan (not implemented)  
> **Veo API reference:** [Documentation/veo-api-research.md](../Documentation/veo-api-research.md)  
> **Video processing:** [Very Good FFmpeg](https://verygoodffmpeg.com/docs) (external; no ffmpeg on Convex)  
> **Last updated:** 2026-06-17

---

## 1. Feature summary

A new app section **“Goal highlights”** (navbar between Automations and Connected Socials, video icon) lets a user paste a **public Veo match URL**. Matchscore:

1. Fetches highlight metadata from Veo’s web API
2. Filters **all goal events** (see §2) — never `shot-on-goal`
3. Sends goal clip CDN URLs to **Very Good FFmpeg** for concatenation (VGF downloads from Veo; we do not)
4. Receives a webhook when processing completes
5. Downloads the **final compiled MP4 once** and stores it in **Convex file storage**
6. Links the result to a **`veoPostJobs`** database row for the organisation

MVP scope: **preview + download only**. Social posting is a later phase.

This is **separate from automations** — no template editor, no scheduled posting in v1.

---

## 2. Confirmed product decisions

| # | Decision |
|---|----------|
| 1 | **Nav label:** “Goal highlights” with a **video icon** (`Video` from lucide-react) |
| 2 | **Goal filter:** **All goals** — any goal-type tag; explicitly **exclude** `shot-on-goal` |
| 3 | **Re-submit same URL:** Always create a **new job**; keep full **history** (no replace/dedupe) |
| 4 | **Retention:** Auto-expire compilations after **90 days** (delete MP4 + job row) |
| 5 | **History UI:** Chronological list per org (see §4.2) |
| 6 | **Legal:** OK to use Veo’s undocumented public web API |
| 7 | **MVP output:** Preview in browser + download link only; social automations later |
| 8 | **No goals found:** Hard error — “No goals found in this match” |
| 9 | **Max goals per job:** Cap at **15** (~200 MB VGF input) |

### Goal tag filter (all goals)

Include a highlight when any tag matches:

```typescript
const NON_GOAL_SLUGS = new Set(["shot-on-goal"]);

export function isGoalHighlightTag(slug: string): boolean {
  if (NON_GOAL_SLUGS.has(slug)) return false;
  if (slug === "goal") return true;
  if (slug.endsWith("-goal")) return true; // penalty-goal, own-goal, …
  return false;
}
```

Sort matched highlights by `start` ascending before concat. Re-fetch from Veo on each new job (no cached source URLs in DB).

---

## 3. Architecture

```
┌──────────┐    ┌─────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ Next.js  │───▶│ Convex      │───▶│ Veo API          │    │ Very Good FFmpeg │
│ /goal-highlights│ │ mutation    │    │ (public match)   │    │ POST /api/ffmpeg │
└──────────┘    └──────┬──────┘    └──────────────────┘    └────────┬────────┘
                       │                                                │
                       │         ┌──────────────────┐                     │
                       └────────▶│ Convex action    │─────────────────────┘
                                 │ submit VGF job   │   (Veo CDN URLs as inputs)
                                 └──────────────────┘
                                           │
                       ┌───────────────────┴───────────────────┐
                       ▼                                       ▼
              ┌─────────────────┐                   ┌─────────────────┐
              │ Convex HTTP      │◀── webhook ──────│ VGF worker      │
              │ /webhooks/vgffmpeg│                   │ (concat + encode)│
              └────────┬─────────┘                   └─────────────────┘
                       │
                       ▼
              ┌─────────────────┐
              │ internal action  │  fetch output URL → ctx.storage.store
              │ + mutation       │  patch veoPostJobs → ready
              └─────────────────┘
                       │
                       ▼
              ┌─────────────────┐
              │ UI (useQuery)    │  reactive video player
              └─────────────────┘
```

**Principle:** Convex orchestrates only. **No large video bytes** pass through mutations. **No ffmpeg binary** on Convex.

---

## 4. UI & routing

### 4.1 Navigation

Insert between Automations and Connected Socials in `components/app-sidebar.tsx`:

| Property | Value |
|----------|-------|
| Route | `/app/goal-highlights` |
| Label | Goal highlights |
| Icon | `Video` (lucide-react) |
| i18n key | `app.shell.nav.goalHighlights` (+ FR/NL as needed) |

### 4.2 Page layout (recommended history UX)

Single page, top to bottom:

1. **Create** — Veo URL input + “Generate” button
2. **Preview** (after submit) — match title, clubs, score, goal count before processing starts
3. **Active job** — inline status for the job just created (`fetching` → `processing` → `ready` / `failed`)
4. **History** — all org jobs, **`createdAt` descending**

Each history row shows:

| Column | Content |
|--------|---------|
| Match | `veoMatchTitle` (fallback: slug) |
| Meta | Goal count · created date · “Expires {date}” for `ready` jobs |
| Status | Badge: processing / ready / failed / expired (only while visible before cron) |
| Actions | Play/expand when `ready`; download; optional manual delete (Phase 3) |

**Why this layout:** Users often re-generate the same match; a flat chronological list makes every run visible without hiding older compilations. Grouping by match slug is optional polish later — not needed for MVP.

Use Sonner toasts via `@/lib/user-feedback` on success/failure.

### 4.3 Layout

Standard app shell (`max-w-4xl`), same as automations overview — not full-width editor.

---

## 5. Convex backend structure

Follow [Documentation/convex-structure.md](../Documentation/convex-structure.md):

```text
convex/
├── veoPosts/
│   ├── queries.ts           # listJobs, getJob
│   ├── mutations.ts         # createJob, markProcessing, markReady, markFailed, deleteJob
│   ├── actions.ts           # "use node" — fetch Veo, submit VGF job
│   ├── internalActions.ts   # "use node" — download VGF output → storage
│   ├── internalMutations.ts # status patches from webhook/action
│   ├── helpers.ts           # parse URL, filter goals, build ffmpeg command
│   └── validators.ts
├── http.ts                  # POST /webhooks/vgffmpeg
├── crons.ts                 # daily expiry cleanup (90 days)
└── schema.ts                # veoPostJobs table
```

---

## 6. Database schema

```typescript
veoPostJobs: defineTable({
  organizationId: v.id("organizations"),
  createdByUserId: v.string(),

  // Input
  veoMatchSlug: v.string(),
  veoMatchUrl: v.string(),

  // Denormalized match metadata (small strings — no re-fetch for list UI)
  veoMatchTitle: v.optional(v.string()),
  veoClubName: v.optional(v.string()),
  veoOpponentName: v.optional(v.string()),
  veoScoreOwn: v.optional(v.number()),
  veoScoreOpponent: v.optional(v.number()),

  // Processing
  status: v.union(
    v.literal("pending"),      // row created
    v.literal("fetching"),     // loading Veo metadata
    v.literal("processing"),   // VGF job submitted / running
    v.literal("ready"),
    v.literal("failed"),
  ),
  goalCount: v.optional(v.number()),
  goalStartsSeconds: v.optional(v.array(v.number())), // chronological order
  goalHighlightIds: v.optional(v.array(v.string())),  // Veo highlight UUIDs

  // External job correlation
  vgffmpegJobId: v.optional(v.string()),

  // Output (only persisted binary)
  outputStorageId: v.optional(v.id("_storage")),
  outputByteSize: v.optional(v.number()),
  outputDurationSeconds: v.optional(v.number()),

  errorMessage: v.optional(v.string()),
  createdAt: v.number(),
  completedAt: v.optional(v.number()),
  failedAt: v.optional(v.number()),
  expiresAt: v.optional(v.number()), // completedAt + 90 days when status → ready
})
  .index("by_organizationId", ["organizationId"])
  .index("by_organizationId_and_createdAt", ["organizationId", "createdAt"])
  .index("by_vgffmpegJobId", ["vgffmpegJobId"])
  .index("by_expiresAt", ["expiresAt"]),
```

**Index note:** No dedupe index on `(organizationId, veoMatchSlug)` — same match may produce many historical jobs.

---

## 7. Storage policy (what we keep)

### 7.1 The only video file we store

| Stored | Not stored |
|--------|------------|
| **One compiled MP4 per successful job** (`outputStorageId`) | Individual goal clip MP4s |
| | Full match video (~3.9 GB) |
| | VGF intermediate files |
| | Veo CDN URLs (transient in action memory only) |
| | VGF output URL after copy to Convex |

**Individual goal clips are never written to Convex storage.** VGF fetches them directly from Veo’s CDN, concatenates, and returns one output file. We download that output once and store it. There is no reason to keep the source clips ourselves.

### 7.2 Metadata we keep (cheap)

| Field | Purpose |
|-------|---------|
| Match title, clubs, score | History list without re-calling Veo |
| `goalCount`, `goalStartsSeconds`, `goalHighlightIds` | Audit / support (“which goals were included”) |
| `outputByteSize`, `outputDurationSeconds` | UI + cost awareness |
| `expiresAt` | 90-day TTL display + cron cleanup |
| `vgffmpegJobId` | Debug failed jobs |

Do **not** persist: raw Veo JSON, per-goal MP4 URLs, webhook bodies, thumbnails as files (optional: store Veo `thumbnail` URL string for list UI — ~100 bytes, re-fetchable anyway).

### 7.3 Retention: 90-day auto-expire

When a job reaches `ready`:

```typescript
expiresAt = completedAt + 90 * 24 * 60 * 60 * 1000;
```

**Daily cron** (`convex/crons.ts`):

1. Query jobs where `expiresAt < Date.now()` (index `by_expiresAt`)
2. If `outputStorageId` exists → `ctx.storage.delete(outputStorageId)`
3. Delete the `veoPostJobs` row (including `failed` jobs older than 90 days — no blob, keeps DB lean)

Show “Expires on …” in history UI for ready jobs.

### 7.4 Anti-bloat checklist

| Risk | Mitigation |
|------|------------|
| Storing per-goal clips | **Never** — only compiled output |
| Failed job leaves orphan blob | Only call `storage.store` after VGF success; on failure, no `outputStorageId` |
| Duplicate webhook stores twice | Idempotent handler: skip if already `ready` |
| Re-submit same URL | New row + new blob; old rows expire on their own 90-day clock |
| VGF output not copied | Download to Convex within webhook action; never link UI to VGF URL long-term |
| Unbounded history | 90-day cron caps storage per org (~45 MB × jobs in rolling window) |
| Large match (15 goals) | Hard cap at 15 goals; ~200 MB input to VGF, ~200 MB output stored |
| Streaming download | Use `fetch` → `Blob` → `storage.store` once; don’t buffer multiple copies in memory |
| Manual delete (Phase 3) | Optional “Delete now” removes blob + row early |

### 7.5 Storage cost estimate (with 90-day TTL)

Assume ~45 MB per successful compilation, rolling 90-day window:

| Activity | Approx. steady-state storage |
|----------|------------------------------|
| 1 org · 2 compilations/month | ~90 MB × 3 months ≈ **270 MB** max |
| 20 orgs · same rate | ~**5.4 GB** max |

Without expiry, the same usage would grow without bound. **90-day TTL is the main storage control.**

Metadata rows are negligible (< 2 KB each).

---

## 8. Job lifecycle

| Status | Trigger | Next step |
|--------|---------|-----------|
| `pending` | User submits URL | Schedule `processVeoPostJob` action |
| `fetching` | Action starts | GET Veo match + highlights |
| `processing` | Goals found | POST Very Good FFmpeg job; save `vgffmpegJobId` |
| `ready` | Webhook `succeeded` | Output in Convex storage; UI shows video |
| `failed` | Any error | Set `errorMessage`; toast user |

### Idempotency

- Webhook handler: look up job by `vgffmpegJobId` (primary) or query param `jobId` (Convex `Id<"veoPostJobs">`) — **prefer Convex job id in webhook URL**, not only `matchSlug`
- Ignore duplicate webhooks if status is already `ready`

Suggested webhook URL:

```
https://{deployment}.convex.site/webhooks/vgffmpeg?jobId={veoPostJobId}
```

---

## 9. Very Good FFmpeg integration

Official docs: [verygoodffmpeg.com/docs](https://verygoodffmpeg.com/docs)

### 9.1 Corrections vs draft integration notes

| Draft assumption | Verified fact |
|------------------|---------------|
| `ffmpeg_command` (string) | **`ffmpeg_commands`** (string array) |
| `highlightsData.results` | Veo returns a **top-level JSON array** |
| Poll only | Polling via `GET /api/jobs/{id}` **and** optional `webhook_url` |
| Output URL permanent | **Signed URLs, 7-day lifetime**; files retained on VGF **30 days** — copy to Convex promptly |
| `@ffmpeg.wasm` / local ffmpeg | **Not used** — all processing on VGF |

### 9.2 Submit job

```
POST https://verygoodffmpeg.com/api/ffmpeg
Authorization: Bearer {VGFFMPEG_API_KEY}
Content-Type: application/json
```

```json
{
  "input_files": {
    "goal1.mp4": "https://c.veocdn.com/.../video.mp4",
    "goal2.mp4": "https://c.veocdn.com/.../video.mp4"
  },
  "output_files": ["goals.mp4"],
  "ffmpeg_commands": [
    "-i {{goal1.mp4}} -i {{goal2.mp4}} -filter_complex \"[0:v][0:a][1:v][1:a]concat=n=2:v=1:a=1[outv][outa]\" -map \"[outv]\" -map \"[outa]\" -c:v libx264 -crf 23 -preset fast {{goals.mp4}}"
  ],
  "webhook_url": "https://fine-wolf-59.eu-west-1.convex.site/webhooks/vgffmpeg?jobId=...",
  "machine": "cpu"
}
```

Response:

```json
{
  "data": {
    "id": "8f3c2b6a-4d9e-4f0c-9b5a-2d3e4f5a6b7c",
    "status": "queued",
    "output_files": {},
    "error_message": ""
  }
}
```

### 9.3 Why concat filter (not concat demuxer)

VGF downloads remote inputs to the worker filesystem. The **concat demuxer** needs a local `filelist.txt` with paths only known after download — awkward to generate remotely.

The **concat filter** accepts multiple `-i {{goalN.mp4}}` inputs via URL templating. It **re-encodes** (`libx264`), which is acceptable for separate MP4 segments.

**Risk:** Filter assumes each input has **video + audio** streams. If a clip lacks audio, ffmpeg fails. **Spike required** — verify with `ffprobe` on goal clips; fallback command may need `anullsrc` or video-only concat.

### 9.4 Command builder (TypeScript)

```typescript
export function buildVgfConcatCommand(
  inputFiles: Record<string, string>,
): { ffmpegCommands: string[]; outputFiles: string[] } {
  const entries = Object.entries(inputFiles);
  const n = entries.length;
  if (n < 1) throw new Error("At least one goal clip required");

  const inputs = entries.map(([name]) => `-i {{${name}}}`).join(" ");
  const filterInputs = Array.from({ length: n }, (_, i) => `[${i}:v][${i}:a]`).join("");
  const filter = `${filterInputs}concat=n=${n}:v=1:a=1[outv][outa]`;
  const command =
    `${inputs} -filter_complex "${filter}" -map "[outv]" -map "[outa]" ` +
    `-c:v libx264 -crf 23 -preset fast {{goals.mp4}}`;

  return {
    ffmpegCommands: [command],
    outputFiles: ["goals.mp4"],
  };
}

export function buildGoalInputFiles(
  goalHighlights: { id: string; videos: { url: string }[] }[],
): Record<string, string> {
  return Object.fromEntries(
    goalHighlights.map((h, i) => [`goal${i + 1}.mp4`, h.videos[0]!.url]),
  );
}
```

For a **single goal**, skip concat — copy or transcode one input to output (simpler command).

### 9.5 Job status (polling fallback)

```
GET https://verygoodffmpeg.com/api/jobs/{id}
```

Statuses: `queued` → `running` → `succeeded` | `failed` | `cancelled`

Use polling only as **fallback** if webhook delivery fails (scheduled check after N minutes).

Optional wait mode: `POST /api/ffmpeg?wait=true` blocks up to **15 minutes** — avoid in Convex actions (prefer webhook + internal action).

### 9.6 Billing (VGF)

Billed by **processed GB** (input bytes read + output bytes written). Failed jobs still bill bytes processed before failure. Typical 3-goal job: ~41 MB in + ~45 MB out ≈ **0.086 GB** per compilation.

### 9.7 TypeScript SDK (optional)

```bash
pnpm add @verygoodffmpeg/sdk
```

```typescript
import { VGF } from "@verygoodffmpeg/sdk";

const client = new VGF(process.env.VGFFMPEG_API_KEY!);
const job = await client.jobs.create({
  inputFiles,
  outputFiles,
  ffmpegCommands,
  webhookUrl,
  machine: "cpu",
});
```

SDK details live in the [npm package README](https://www.npmjs.com/package/@verygoodffmpeg/sdk). Raw `fetch` is fine if SDK API differs slightly — verify against live API during spike.

### 9.8 Webhook handler (Convex pattern)

**Do not** use `ctx.storage` directly in a naive HTTP handler snippet — Convex HTTP routes use `httpAction`, which has `runMutation` / `runAction` only.

```typescript
// convex/http.ts
import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

http.route({
  path: "/webhooks/vgffmpeg",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const jobId = new URL(request.url).searchParams.get("jobId");
    if (!jobId) return new Response("Missing jobId", { status: 400 });

    const payload: unknown = await request.json();
    // Validate payload shape; extract data.id, data.status, data.output_files

    await ctx.scheduler.runAfter(0, internal.veoPosts.internalActions.handleVgfWebhook, {
      veoPostJobId: jobId as Id<"veoPostJobs">,
      payload,
    });

    return new Response("OK", { status: 200 });
  }),
});
```

Heavy work (download ~45 MB, `ctx.storage.store`) runs in **`internalActions.handleVgfWebhook`** (`"use node"`), not inline in the HTTP handler — return 200 quickly so VGF does not retry unnecessarily.

Webhook payload shape (from VGF docs + expected fields — **verify on first live job**):

```json
{
  "data": {
    "id": "uuid",
    "status": "succeeded",
    "output_files": {
      "goals.mp4": "https://storage.verygoodffmpeg.com/..."
    },
    "error_message": "",
    "total_input_bytes": 41875931,
    "total_output_bytes": 45234128
  }
}
```

**Security:** Validate `jobId` exists and `vgffmpegJobId` matches `payload.data.id` before storing output.

---

## 10. Environment variables

| Variable | Where | Purpose |
|----------|-------|---------|
| `VGFFMPEG_API_KEY` | Convex env | Submit jobs to VGF |
| `CONVEX_SITE_URL` | Convex env | Webhook base, e.g. `https://fine-wolf-59.eu-west-1.convex.site` |

Set via:

```bash
npx convex env set VGFFMPEG_API_KEY "..."
npx convex env set CONVEX_SITE_URL "https://YOUR-DEPLOYMENT.convex.site"
```

Use the same host as `NEXT_PUBLIC_CONVEX_SITE_URL` in `.env.local`.

Add placeholders to `.env.example` (Convex-only secrets — not Next.js public vars).

---

## 11. Error handling

| Scenario | User message | System action |
|----------|--------------|---------------|
| Invalid URL / slug | “Paste a valid app.veo.co match link” | Fail before job row |
| Veo 404 | “Match not found or private” | `failed` |
| `privacy !== "public"` | “This match is not public” | `failed` (if verified) |
| No goals | “No goals found in this match” | `failed` |
| > max goals | “Too many goals (max 15)” | `failed` |
| Missing `videos[0]` | “Goal clip not ready yet” | `failed` |
| VGF `failed` | Show `error_message` | `failed` |
| Output download fails | “Could not save video” | Retry once in action, then `failed` |
| Duplicate webhook | — | No-op if already `ready` |

---

## 12. Security

1. All mutations/queries scoped to **organisation membership** (same helpers as automations).
2. `VGFFMPEG_API_KEY` never exposed to client.
3. Webhook endpoint is public — validate `jobId` + `vgffmpegJobId` correlation.
4. Do not trust client-supplied goal URLs — only URLs from server-side Veo fetch.
5. Rate-limit job creation per org (optional Phase 2).

---

## 13. Implementation phases

### Phase 0 — Spike (required before UI)

1. Obtain VGF API key
2. Convex action: fetch real match goals → submit 3-clip concat job with webhook
3. Implement HTTP webhook + internal action → Convex storage
4. Confirm audio streams exist on goal clips (or adjust ffmpeg command)
5. Document actual webhook payload in a comment or test fixture

### Phase 1 — Backend

1. `veoPostJobs` schema + indexes (including `expiresAt`)
2. `veoPosts/` module (queries, mutations, actions, helpers)
3. Webhook route in `http.ts`
4. Daily cron: 90-day expiry cleanup
5. Env vars + `.env.example`

### Phase 2 — UI

1. Sidebar nav item (“Goal highlights”, `Video` icon) + i18n
2. `/app/goal-highlights` page (form, preview, active job, history list)
3. Sonner feedback

### Phase 3 — Hardening

1. Manual “Delete now” (early blob + row removal)
2. Polling fallback for missed webhooks
3. Optional link to calendar match
4. Social automation handoff (future — out of MVP scope)

---

## 14. Testing plan

| Test | Method |
|------|--------|
| URL parsing | Unit tests on `parseVeoMatchSlug` |
| Goal filter | Unit tests with fixture JSON from [veo-api-research.md](../Documentation/veo-api-research.md) |
| FFmpeg command builder | Unit test for n=1, n=3 |
| Veo fetch | Integration script (like `pnpm test:voetbalinbelgie-api`) |
| End-to-end | Manual: example public match → ready video in UI |
| Webhook | VGF dashboard test hook or replay saved payload |

Suggested script: `pnpm test:veo-api` (future).

---

## 15. Files to create/modify (checklist)

| File | Action |
|------|--------|
| `Documentation/veo-api-research.md` | ✅ Created |
| `plan/veo-posts.md` | ✅ This file |
| `convex/schema.ts` | Add `veoPostJobs` |
| `convex/veoPosts/*` | New module |
| `convex/http.ts` | Webhook route |
| `components/app-sidebar.tsx` | Nav item |
| `app/app/goal-highlights/page.tsx` | New page |
| `convex/crons.ts` | 90-day expiry cleanup |
| `messages/en.json`, `fr.json`, … | i18n strings |
| `.env.example` | Document Convex env vars |

---

## 16. Related documentation

| Doc | Purpose |
|-----|---------|
| [Documentation/veo-api-research.md](../Documentation/veo-api-research.md) | Veo endpoints, response shapes, samples |
| [Documentation/convex-structure.md](../Documentation/convex-structure.md) | Folder conventions |
| [Very Good FFmpeg — Running Commands](https://verygoodffmpeg.com/docs/basics/running-commands) | Job submission |
| [Very Good FFmpeg — Jobs](https://verygoodffmpeg.com/docs/basics/jobs) | Status, output URLs, retention |
| [Very Good FFmpeg — TypeScript SDK](https://verygoodffmpeg.com/docs/integrations/typescript-sdk) | Optional SDK |

---

## 17. Open technical gaps

1. **Webhook payload schema** — jobs docs confirm webhooks exist; dedicated webhooks page returned 404. Validate full payload on first production job.
2. **Audio on goal clips** — concat filter assumes `[i:a]` exists; verify with ffprobe during spike.
3. **Private Veo matches** — behaviour untested.
4. **Other goal tag slugs** — allowlist in §2 covers `-goal` suffix; add to `NON_GOAL_SLUGS` if false positives appear.
5. **VGF webhook signing** — docs did not expose HMAC verification; confirm whether requests can be forged (mitigate with secret query token on webhook URL).
