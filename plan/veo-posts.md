# Goal highlights — implementation plan

> **Status:** Phase 1 complete · Phase 2 next  
> **Veo API reference:** [Documentation/veo-api-research.md](../Documentation/veo-api-research.md)  
> **Video processing:** [Very Good FFmpeg](https://verygoodffmpeg.com/docs) (external; no ffmpeg on Convex)  
> **Last updated:** 2026-06-18 (Phase 1 shipped on `veo-posts`)

---

## 1. Feature summary

A new app section **“Goal highlights”** (navbar between Automations and Connected Socials, video icon) lets a user paste a **public Veo match URL**. Matchscore:

1. Fetches highlight metadata from Veo’s web API
2. Filters **all goal events** (see §2) — never `shot-on-goal`
3. Sends goal clip CDN URLs to **Very Good FFmpeg** for concatenation (VGF downloads from Veo; we do not)
4. Receives a webhook when processing completes
5. Downloads the **final compiled MP4 once** and stores it in **Convex file storage**
6. Links the result to a **`veoPostJobs`** database row for the organisation

MVP scope: **compile goal highlights**, **preview + download**, and a **social compose shell** (caption + channel toggles + disabled “Post to social” until the video is ready). Actual posting to Facebook/Instagram is **not wired yet**.

This is **separate from automations** — no template editor — but reuses the **same social channel UI patterns** as the automations overview.

---

## 2. Confirmed product decisions

| # | Decision |
|---|----------|
| 1 | **Nav label:** “Goal highlights” with a **video icon** (`Video` from lucide-react) |
| 2 | **Goal filter:** **All goals** — any goal-type tag; explicitly **exclude** `shot-on-goal` |
| 3 | **Re-submit same URL:** **Do not reprocess** if a `ready` job with a valid stored video already exists for this org + slug — **open that job** instead |
| 4 | **Retention:** Auto-expire compilations after **90 days** (delete MP4 + job row) |
| 5 | **History UI:** List past jobs; selecting one opens the job workspace (see §4) |
| 6 | **Legal:** OK to use Veo’s undocumented public web API |
| 7 | **Social compose (MVP):** Caption textarea + channel toggles visible **during processing**; “Post to social” **disabled** until video is `ready`; button is a **no-op stub** for now |
| 8 | **Private match:** Toast error — **do not create a job row** |
| 9 | **No goals found:** Toast error — **do not create a job row** |
| 10 | **Max goals per job:** Cap at **15** (~200 MB VGF input) |
| 11 | **Invalid Veo URL / validation errors:** Toast with translated message — **never persist a failed row** (retry same URL later after e.g. making match public) |
| 12 | **Score mismatch (AI vs scoreline):** Proceed with compilation; show inline **warning** on job workspace |
| 13 | **In-flight dedupe:** Reopen existing job **silently** (no toast) |

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

Sort matched highlights by `start` ascending before concat. Re-fetch from Veo only when creating a **new** job (not when reopening an existing `ready` job).

### Dedupe rule (same Veo link)

On submit, parse slug and look up existing job for `(organizationId, veoMatchSlug)`:

| Existing job | Action |
|--------------|--------|
| `ready` + `outputStorageId` + `expiresAt > now` | **Open existing job** — no Veo/VGF calls |
| `pending` / `fetching` / `processing` | **Open in-flight job** — do not start a second pipeline |
| `failed`, or `ready` but expired / missing blob | **Create new job** and process again |
| None | **Create new job** and process |

Toast when reopening: “Opening existing compilation for this match.”

---

## 3. Architecture

```
┌──────────┐    ┌─────────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ Next.js  │───▶│ Convex action       │───▶│ Veo API          │    │ Very Good FFmpeg │
│ /goal-highlights│ │ createOrOpenJob     │    │ (public match)   │    │ POST /api/ffmpeg │
└──────────┘    └──────────┬──────────┘    └──────────────────┘    └────────┬────────┘
                             │ validate first; insert job only on success          │
                             │         ┌──────────────────┐                     │
                             └────────▶│ (Phase 2) submit   │─────────────────────┘
                                       │ VGF job            │   (Veo CDN URLs as inputs)
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

### 4.2 Page structure — two views on one route

Route: `/app/goal-highlights` (list) and `/app/goal-highlights/[jobId]` (workspace). Alternatively a single page with list + selected job panel — **prefer separate `[jobId]` route** so reopen/dedupe can navigate directly.

#### A. List view (`/app/goal-highlights`)

1. **URL input** — single text field + “Generate” (primary)
2. **History** — org jobs, `createdAt` descending; click row → job workspace
3. On Generate: run dedupe (§2); navigate to existing or new `[jobId]`

#### B. Job workspace (`/app/goal-highlights/[jobId]`)

Single column, `max-w-4xl`, top to bottom:

```
┌─────────────────────────────────────────────────────────┐
│ ← Back    Berchem - KSVA-Seniors-A    [status badge]    │
├─────────────────────────────────────────────────────────┤
│ VIDEO AREA                                              │
│  • processing: skeleton + “Compiling goal highlights…”  │
│  • ready: <video controls> preview + Download           │
│  • failed: inline error (also surfaced via toast)       │
├─────────────────────────────────────────────────────────┤
│ Match meta: score · N goals · expires on …              │
├─────────────────────────────────────────────────────────┤
│ Caption                                                 │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Textarea — editable while processing & after     │   │
│  └─────────────────────────────────────────────────┘   │
│  (autosave draft to job row on blur/debounce)           │
├─────────────────────────────────────────────────────────┤
│ Social channels (same visual pattern as automations)    │
│  Facebook    Posts [switch]  Story [switch]           │
│  Instagram   Posts [switch]  Story [switch]           │
│  (reuse PlatformBlock / posting channel toggles)        │
├─────────────────────────────────────────────────────────┤
│ [ Post to social ]  ← disabled until status === ready   │
│                     ← no-op stub (toast “Coming soon”)  │
└─────────────────────────────────────────────────────────┘
```

**UX details:**

| Moment | Behaviour |
|--------|-----------|
| User submits URL | Client calls **`createOrOpenJob` action**; Veo validated before any row is inserted |
| Private / 404 / no goals / invalid URL | Sonner **error** toast (translated); **stay on list** — no job row |
| Processing | Video area shows skeleton; compose UI deferred to Phase 3 |
| Ready | Video preview loads via storage URL; **Post to social** enables (Phase 3 stub) |
| Post click (stub) | Phase 3 — toast: “Social posting coming soon” |
| Re-open cached ready job | Toast: “Opening existing compilation”; video visible immediately |
| Re-open in-flight job | Navigate silently to existing workspace |

**Social channels:** Reuse automations UI building blocks (`PlatformBlock` pattern from `automation-type-card.tsx`, `postingChannelStatusesValidator`, Facebook/Instagram × posts/story). Read org connection state from existing automations/socials queries where available; toggles persist on **`veoPostJobs.postingChannels`** for this compilation (not global automation settings).

Use Sonner via `@/lib/user-feedback` for all user-initiated errors and the stub post action.

### 4.3 Layout

Standard app shell (`max-w-4xl`), same width as automations overview.

---

## 5. Convex backend structure

Follow [Documentation/convex-structure.md](../Documentation/convex-structure.md):

```text
convex/
├── veoPosts/
│   ├── queries.ts           # listJobs, getJob
│   ├── actions.ts           # "use node" — createOrOpenJob (validate Veo, insert job)
│   ├── internalQueries.ts   # getCreateOrOpenPlan (auth + dedupe)
│   ├── internalMutations.ts # insertProcessingJob, markFailed (Phase 2+)
│   ├── internalActions.ts   # "use node" — (Phase 2) download VGF output → storage
│   ├── access.ts            # org-scoped job lookups
│   ├── helpers.ts           # parse URL, filter goals, Veo fetch client
│   └── validators.ts
lib/
└── goal-highlights/
    ├── errors.ts            # shared error codes (ConvexError data)
    └── get-error-message.ts # map codes → i18n on client
├── http.ts                  # (Phase 2) POST /webhooks/vgffmpeg
├── crons.ts                 # (Phase 3) daily expiry cleanup (90 days)
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

  // Social compose (draft — posting not wired in MVP)
  draftCaption: v.optional(v.string()),
  postingChannels: postingChannelStatusesValidator, // same shape as organizationAutomations

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
  warningMessage: v.optional(v.string()),             // scoreline vs goal-count mismatch

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
  .index("by_organizationId_and_veoMatchSlug", ["organizationId", "veoMatchSlug"])
  .index("by_vgffmpegJobId", ["vgffmpegJobId"])
  .index("by_expiresAt", ["expiresAt"]),
```

**Dedupe lookup:** query `by_organizationId_and_veoMatchSlug`, filter in handler for `ready` + valid `expiresAt` (or in-flight statuses). Compound index supports efficient slug lookup per org.

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
| Re-submit same URL | Dedupe to existing `ready` job (§2); no second blob |
| Same URL while in-flight | Open existing job; never two pipelines per slug |
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

| Status | Trigger | UI |
|--------|---------|-----|
| `processing` | Veo validation succeeded; job row inserted (VGF stub in Phase 1) | Skeleton + “Compiling goal highlights…” |
| `ready` | Webhook success (Phase 2) | Video preview + Download; Post button enabled (Phase 3 stub) |
| `failed` | VGF / download error (Phase 2+) | Error message + toast; Post stays disabled |

`pending` / `fetching` remain in schema for Phase 2 pipeline states but are **not used** in Phase 1 create flow.

### Create flow (`createOrOpenJob` action — Phase 1)

1. `internalQueries.getCreateOrOpenPlan` — auth, parse URL, dedupe (§2)
2. If reopen → return `{ jobId, reopened }` immediately
3. **`validateVeoMatchForCompilation`** in action (Veo HTTP) — on failure throw `ConvexError({ code })` → **no row**
4. `internalMutations.insertProcessingJob` — row inserted as `processing` with match + goal metadata
5. Return `{ jobId, reopened: false }` for navigation

Client maps error codes to translated toasts via `lib/goal-highlights/get-error-message.ts`.

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
| Invalid URL / slug | Toast: translated `errors.invalidUrl` | Reject before job row |
| Veo 404 / private | Toast: translated `errors.notPublic` | **No job row** |
| No goals | Toast: translated `errors.noGoals` | **No job row** |
| Existing ready job | Toast: “Opening existing compilation…” | Navigate; no processing |
| > max goals | Toast: translated `errors.tooManyGoals` | **No job row** |
| Missing `videos[0]` | Toast: translated `errors.clipNotReady` | **No job row** |
| Veo fetch error | Toast: translated `errors.fetchFailed` | **No job row** |
| Score mismatch | Inline warning on workspace | Proceed; store `warningMessage` |
| VGF `failed` (Phase 2) | Show `error_message` | `failed` row kept |
| Output download fails (Phase 2) | “Could not save video” | Retry once, then `failed` |
| Duplicate webhook | — | No-op if already `ready` |

---

## 12. Security

1. All mutations/queries scoped to **organisation membership** (same helpers as automations).
2. `VGFFMPEG_API_KEY` never exposed to client.
3. Webhook endpoint is public — validate `jobId` + `vgffmpegJobId` correlation.
4. Do not trust client-supplied goal URLs — only URLs from server-side Veo fetch.
5. Rate-limit job creation per org (optional Phase 2).

---

## 13. Implementation phases (vertical slices)

Each phase ships **backend + frontend + wiring + manual test** before moving on. Max **3 phases** — no horizontal “all backend then all UI”.

---

### Phase 1 — Enter URL, open job, validate Veo, dedupe ✅

**Goal:** User can paste a link, land on a job workspace, and see real match metadata or a clear toast error. Cached compilations reopen instantly.

**Shipped in commit `7443cf7` on branch `veo-posts`.**

#### Backend

- [x] `veoPostJobs` table + indexes (include `draftCaption`, `postingChannels`, `warningMessage`, dedupe index)
- [x] `veoPosts/helpers.ts` — URL parse, goal tag filter, Veo fetch client, `validateVeoMatchForCompilation`
- [x] `createOrOpenJob` **action** — validate Veo before insert; dedupe via `internalQueries.getCreateOrOpenPlan`
- [x] `internalMutations.insertProcessingJob` — insert as `processing` after validation (VGF stub; no submit yet)
- [x] `getJob`, `listJobs` queries
- [ ] ~~`updateDraftCaption` mutation~~ — deferred to Phase 3
- [x] Unit tests: slug parse, goal filter, dedupe helper (`convex/veoPosts/helpers.test.ts`)
- [x] Structured `ConvexError({ code })` + `lib/goal-highlights/errors.ts` for translated client toasts

#### Frontend

- [x] Nav item “Goal highlights” + i18n (en, fr, nl, de)
- [x] List page: URL input, Generate button, history list
- [x] Job workspace route `[jobId]`: header, status badge, match meta, processing skeleton, score-mismatch warning
- [x] Wire `useAction(createOrOpenJob)` → router push; `useQuery(getJob)` reactive status
- [x] Toasts: invalid URL, private match, no goals (translated); reopened cached ready job

#### Manual test checklist

- [x] Public example URL → new job, match title visible, status `processing` (VGF not wired yet)
- [x] Same URL again → opens same job; cached ready shows reopen toast
- [x] Private/invalid URL → error toast, **no job row** in history
- [x] History list shows jobs; click opens workspace

**Phase 1 deviations:** No `pending`/`fetching`/`failed` rows for Veo validation errors. VGF submit deferred to Phase 2 — jobs sit in `processing` until webhook pipeline lands.

---

### Phase 2 — Full video pipeline + preview + download

**Goal:** End-to-end compilation via Very Good FFmpeg; user watches the result in the workspace.

#### Backend

- [ ] VGF job submit after `insertProcessingJob` (concat filter command builder in `helpers.ts`)
- [ ] `POST /webhooks/vgffmpeg` in `http.ts` → schedule `handleVgfWebhook`
- [ ] `internalActions.handleVgfWebhook` — download output, `storage.store`, `markReady` with `expiresAt`
- [ ] `markFailed` paths for VGF + download errors
- [ ] Env: `VGFFMPEG_API_KEY`, `CONVEX_SITE_URL`
- [ ] Optional: polling fallback scheduled from action if webhook slow

#### Frontend

- [ ] Video `<video src={storageUrl} controls>` when `ready`
- [ ] Download link/button (storage URL or blob download)
- [ ] Processing copy updates (`fetching` vs `processing`)
- [ ] Failed state inline in video area

#### Manual test checklist

- [ ] Example public match → webhook fires → video plays in browser
- [ ] Download saves playable MP4
- [ ] Failed VGF job shows error toast + failed UI
- [ ] Dedupe still returns cached video without calling VGF

---

### Phase 3 — Social compose shell, caption persistence, retention

**Goal:** Complete MVP UX — draft post while waiting, channel toggles, disabled-then-enabled stub post button, history polish, 90-day cleanup.

#### Backend

- [ ] `updatePostingChannels` mutation on job row
- [ ] Daily cron — delete expired jobs + storage blobs (§7.3)
- [ ] Default `postingChannels` from org automation settings on job create (optional)

#### Frontend

- [ ] Caption `<Textarea>` — autosave `draftCaption` (debounced mutation)
- [ ] Social channels block — reuse automations `PlatformBlock` / switches (Facebook + Instagram × posts + story)
- [ ] **Post to social** button: `disabled={status !== "ready"}`; onClick → toast “Coming soon” only
- [ ] History list polish: status chips, expiry date, goal count
- [ ] Empty states + back navigation

#### Manual test checklist

- [ ] During processing: can type caption and toggle channels; post button disabled
- [ ] After ready: post button enabled; click shows stub toast only
- [ ] Refresh page — caption + channel toggles restored from DB
- [ ] Cron/manual test: expired job removed from list; re-submit same URL triggers new pipeline

---

### Post-MVP (out of scope for these 3 phases)

- Wire “Post to social” to real Meta APIs
- Link job to calendar `matches` row
- Manual “Delete now” before 90-day expiry
- `pnpm test:veo-api` integration script

---

## 14. Testing plan

| Area | Phase | Method |
|------|-------|--------|
| URL parsing + goal filter | 1 | Unit tests |
| Dedupe helper | 1 | Unit tests + manual same-URL twice |
| Veo validation errors | 1 | Manual + toast assertions |
| VGF webhook + storage | 2 | Manual E2E + fixture payload test |
| Video preview + download | 2 | Manual in browser |
| Caption + channel persistence | 3 | Manual refresh test |
| Post stub button | 3 | Manual — enabled only when `ready` |
| 90-day expiry | 3 | Cron test with shortened TTL in dev |

Suggested script (Phase 2+): `pnpm test:veo-api`

---

## 15. Files to create/modify (checklist)

| File | Phase | Action |
|------|-------|--------|
| `Documentation/veo-api-research.md` | — | ✅ Created |
| `plan/veo-posts.md` | — | ✅ This file |
| `convex/schema.ts` | 1 | ✅ `veoPostJobs` |
| `convex/veoPosts/*` | 1–3 | ✅ Phase 1 module; grow in 2–3 |
| `lib/goal-highlights/*` | 1 | ✅ Error codes + client toast mapping |
| `convex/http.ts` | 2 | Webhook route |
| `convex/crons.ts` | 3 | 90-day expiry |
| `components/app-sidebar.tsx` | 1 | ✅ Nav item |
| `app/app/goal-highlights/page.tsx` | 1 | ✅ List + URL input |
| `app/app/goal-highlights/[jobId]/page.tsx` | 1–3 | ✅ Phase 1 workspace shell |
| `components/goal-highlights/*` | 1–3 | ✅ Phase 1 components |
| `messages/en.json`, `fr.json`, … | 1–3 | ✅ Phase 1 strings (+ `errors.*`) |
| `.env.example` | 2 | Convex env vars |

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
3. **Private Veo matches** — handled generically (403/404, `privacy`, `is_accessible`); no test URL available yet
4. **Other goal tag slugs** — allowlist in §2 covers `-goal` suffix; add to `NON_GOAL_SLUGS` if false positives appear.
5. **VGF webhook signing** — docs did not expose HMAC verification; confirm whether requests can be forged (mitigate with secret query token on webhook URL).
