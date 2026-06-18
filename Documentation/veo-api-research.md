# Veo (app.veo.co) API — research & reference

> **Status:** Research complete (undocumented internal web API)  
> **Feature documentation:** [goal-highlights.md](./goal-highlights.md)  
> **Example match (public):** [KSVA Seniors A vs Berchem](https://app.veo.co/matches/20260321-match-ksva-seniors-a-vee5ec95/)  
> **Last verified:** 2026-06-17

---

## 1. Product context

[Veo](https://www.veo.com/) sells automated sports cameras. Clubs record matches on `app.veo.co`, where Veo’s AI detects events and renders **highlight clips** (including goals). Public match pages can be shared via URL.

**This is not the same as [developer.veo.co.uk](https://developer.veo.co.uk/)** — that is a separate enterprise video-tagging platform with OAuth at `api.veo.co.uk`. Matchscore integrates with **Veo Sports** (`app.veo.co`) only.

There is **no official public API** for sports match highlights. The endpoints below are reverse-engineered from the Veo web app. They may change without notice.

---

## 2. User input → match slug

### Accepted URL patterns

| URL | Slug extracted |
|-----|----------------|
| `https://app.veo.co/matches/20260321-match-ksva-seniors-a-vee5ec95/` | `20260321-match-ksva-seniors-a-vee5ec95` |
| `https://app.veo.co/matches/20260321-match-ksva-seniors-a-vee5ec95` | same |
| `https://app.veo.co/matches/20260321-match-ksva-seniors-a-vee5ec95/highlights` | same |

### Invalid patterns

| URL | Result |
|-----|--------|
| `https://veo.com/matches/...` | 404 (marketing site, not app) |
| `https://www.veo.co/matches/...` | 301 redirect; do not rely on it |

### Parser (TypeScript)

```typescript
const VEO_MATCH_SLUG_RE =
  /(?:https?:\/\/)?(?:app\.)?veo\.co\/matches\/([^/?#]+)/i;

export function parseVeoMatchSlug(veoUrl: string): string | null {
  const match = veoUrl.trim().match(VEO_MATCH_SLUG_RE);
  return match?.[1] ?? null;
}
```

---

## 3. Base URL & headers

| | |
|---|---|
| **Base** | `https://app.veo.co/api/app/matches/{slug}/` |
| **Auth** | None required for **public** matches (verified without cookies) |
| **Recommended headers** | `veo-agent: veo:svc:web-app`, `veo-app-id: hazard` |
| **Referer** | Optional; `https://app.veo.co/matches/{slug}/` |

Public match highlights returned **HTTP 200** even with no headers. Invalid slug → **HTTP 404**. Private/unlisted matches were **not tested** — expect 403/404/empty results.

---

## 4. Endpoints

### 4.1 Match metadata

**Purpose:** Validate the link, show match title/score in UI, sanity-check goal count.

```
GET https://app.veo.co/api/app/matches/{slug}/
```

#### Response shape

Top-level JSON object (not wrapped in `{ results: ... }`).

#### Useful fields (example match)

| Field | Type | Example | Notes |
|-------|------|---------|-------|
| `id` | string (UUID) | `84e9685b-db3a-448e-b5fa-34752c5c8f91` | Internal match id |
| `slug` | string | `20260321-match-ksva-seniors-a-vee5ec95` | Same as URL slug |
| `title` | string | `Berchem - KSVA-Seniors-A` | Display title |
| `privacy` | string | `public` | Check before processing |
| `is_accessible` | boolean | `true` | |
| `duration` | number | `6755` | Match length in **seconds** |
| `start` | ISO datetime | `2026-03-21T12:00:00+01:00` | Kickoff |
| `sport` | string | `football` | |
| `thumbnail` | URL | `https://c.veocdn.com/.../thumbnail.jpg` | Optional UI preview |
| `club.title` | string | `K.SV.Aartselaar` | Recording club |
| `club.crest` | URL | `https://assets.app.veo.co/crests/...` | |
| `opponent_club_name` | string | `Berchem` | |
| `info.stats.score_aggregated.own` | number | `1` | Goals for recording team |
| `info.stats.score_aggregated.opponent` | number | `2` | Goals against |
| `view_count` | number | `47` | |

Use `score_aggregated` as a **sanity check** against the number of goal-tagged highlights (not as a hard filter).

---

### 4.2 Match videos (full recording)

**Purpose:** Full-match MP4/TS streams. **Not used for goal compilation.**

```
GET https://app.veo.co/api/app/matches/{slug}/videos/
```

#### Response shape

JSON **array** of video objects.

#### Example entries

| `render_type` | Resolution | MIME | Approx. size |
|---------------|------------|------|--------------|
| `standard` | 1920×1080 | `video/mp4` | **~3.9 GB** |
| `panorama` | 2048×2048 | `video/mp4` | Large |
| `panorama` | — | `video/mp2t` | Transport stream |

#### Video object fields

| Field | Type | Notes |
|-------|------|-------|
| `identifier` | string | UUID |
| `url` | string | CDN URL |
| `render_type` | `standard` \| `panorama` | |
| `availability` | string | `available` |
| `width`, `height` | number \| null | |
| `mime_type` | string | |
| `thumbnail` | string \| null | |
| `created` | ISO datetime | |

**Recommendation:** Do not call this endpoint for the Veo Posts feature. Goal highlights are pre-cut MP4s (~13 MB each).

---

### 4.3 Match highlights (primary endpoint)

**Purpose:** List AI/user highlights with tags, timing, and **pre-rendered MP4 URLs**.

```
GET https://app.veo.co/api/app/matches/{slug}/highlights/
  ?fields=id
  &fields=start
  &fields=tags
  &fields=videos
  &fields=duration
  &fields=should_render
  &fields=is_ai_generated
  &fields=comment
  &include_ai=true
```

#### Query parameters

| Parameter | Required | Notes |
|-----------|----------|-------|
| `fields` | Repeatable | Sparse fieldset; request only what you need |
| `include_ai` | Recommended | `true` to include AI-generated highlights |

#### Response shape

JSON **array** of highlight objects — **not** `{ results: [...] }`.

Example match: **23** highlights total.

#### Highlight object fields

| Field | Type | Example | Notes |
|-------|------|---------|-------|
| `id` | string (UUID) | `696fef24-715a-49be-8a0c-68dde59446ec` | Stable highlight id |
| `start` | number | `5507` | Seconds from match start (sort key) |
| `duration` | number | `25` | Clip length in seconds |
| `tags` | array | See below | Event classification |
| `videos` | array | See below | Pre-rendered MP4(s) |
| `is_ai_generated` | boolean | `true` | All highlights in test match |
| `should_render` | boolean | `true` | If false, clip may be pending |
| `comment` | string \| null | | User comment |

#### Tag object

| Field | Type | Example |
|-------|------|---------|
| `name` | string | `Goal` |
| `slug` | string | `goal` |
| `origin` | string | `1` |
| `custom` | boolean | `false` |

#### Tag taxonomy (example match)

| `slug` | `name` | Count |
|--------|--------|-------|
| `goal` | Goal | **3** |
| `shot-on-goal` | Shot on goal | 20 |

**Filter for goals:** include tags where `slug === "goal"` or `slug` ends with `-goal`, but **never** `shot-on-goal`. See [goal-highlights.md § Goal selection rules](./goal-highlights.md#goal-selection-rules).

Other slugs (`penalty-goal`, `own-goal`, …) were **not seen** in this match but may exist elsewhere.

#### Video object (inside `videos[]`)

| Field | Type | Example |
|-------|------|---------|
| `url` | string | `https://c.veocdn.com/.../highlight-v2/.../video.mp4` |
| `width` | number | `1920` |
| `height` | number | `1080` |
| `mime_type` | string | `video/mp4` |
| `bit_rate` | number \| null | |
| `created` | ISO datetime | |

Use `videos[0].url` when `videos.length > 0`.

#### Goal clips (example match, chronological)

| Match time | `start` (s) | Size (HEAD) | Highlight id |
|------------|-------------|-------------|--------------|
| 91:47 | 5507 | 13.88 MB | `696fef24-…` |
| 94:26 | 5666 | 12.87 MB | `083542c9-…` |
| 98:23 | 5903 | 14.33 MB | `4a35783c-…` |

**Totals:** 3 goals · 75 s combined · ~41 MB download if fetched individually.

#### Clip size statistics (all 23 highlights)

| Metric | Value |
|--------|-------|
| Min | 12.51 MB |
| Max | 14.36 MB |
| Average | 13.27 MB |
| Resolution | 1920×1080 |
| Duration | 25 s each |

CDN URLs are **public** (byte-range requests return HTTP 206 without auth).

#### Sample goal highlight (truncated)

```json
{
  "id": "4a35783c-d047-4432-b55e-a280683e6c7b",
  "start": 5903,
  "duration": 25,
  "is_ai_generated": true,
  "should_render": true,
  "comment": null,
  "tags": [
    {
      "name": "Goal",
      "slug": "goal",
      "origin": "1",
      "custom": false
    }
  ],
  "videos": [
    {
      "url": "https://c.veocdn.com/84e9685b-db3a-448e-b5fa-34752c5c8f91/highlight-v2/4a35783c-d047-4432-b55e-a280683e6c7b_1774140750.184559/video.mp4",
      "width": 1920,
      "height": 1080,
      "mime_type": "video/mp4",
      "bit_rate": null,
      "created": "2026-03-22T01:54:47.865396+01:00"
    }
  ]
}
```

---

### 4.4 Highlights — alternate field sets (not needed separately)

The web app calls highlights twice with different `fields=` lists:

1. Metadata only (`tags`, `start`, `duration`, …) — no `videos`
2. Media + permissions (`videos`, `thumbnail`, `permissions`, …)

**Use one combined request** (§4.3). A second call is redundant.

---

## 5. Processing pipeline (data flow)

```
User pastes app.veo.co/matches/{slug}/ URL
        │
        ▼
Parse slug
        │
        ├── GET /matches/{slug}/          → title, score, privacy (UI + validation)
        │
        └── GET /matches/{slug}/highlights/ → filter slug=goal, sort by start
                    │
                    ▼
            Extract videos[0].url for each goal
                    │
                    ▼
            Pass public URLs to Very Good FFmpeg (concat)
                    │
                    ▼
            Store final MP4 in Convex storage (see plan)
```

Matchscore does **not** need to download individual goal clips to Convex. Very Good FFmpeg fetches them from Veo CDN.

---

## 6. Edge cases & risks

| Scenario | Expected behaviour | Mitigation |
|----------|-------------------|------------|
| Invalid slug | HTTP 404 | Clear error: “Match not found” |
| Private match | Unknown (untested) | Check `privacy` / `is_accessible`; fail gracefully |
| No `goal` tags | Empty filter result | Fail: “No goals found” |
| `should_render: false` | Missing or stale `videos` | Skip or wait; surface “highlight still rendering” |
| Same `start`, different tags | e.g. goal + shot-on-goal at 5666s | Filter by slug only |
| AI mis-tags | Score vs goal count mismatch | Warn user; optional manual review later |
| CDN URL expiry | Unknown | Process soon; do not long-term store source URLs |
| API breaking change | Possible anytime | Monitor failures; no official SLA |
| ToS / scraping | Undocumented API | Product/legal decision required |

---

## 7. TypeScript types (suggested)

```typescript
export type VeoHighlightTag = {
  name: string;
  slug: string;
  origin: string;
  custom: boolean;
};

export type VeoHighlightVideo = {
  url: string;
  width: number;
  height: number;
  mime_type: string;
  bit_rate: number | null;
  created: string;
};

export type VeoHighlight = {
  id: string;
  start: number;
  duration: number;
  tags: VeoHighlightTag[];
  videos: VeoHighlightVideo[];
  is_ai_generated?: boolean;
  should_render?: boolean;
  comment: string | null;
};

export type VeoMatchSummary = {
  slug: string;
  title: string;
  privacy: string;
  is_accessible: boolean;
  duration: number;
  scoreOwn: number | null;
  scoreOpponent: number | null;
  clubName: string;
  opponentName: string;
  thumbnailUrl: string | null;
};
```

---

## 8. HTTP client helper (sketch)

```typescript
const VEO_API = "https://app.veo.co/api/app/matches";

const veoHeaders = {
  accept: "*/*",
  "veo-agent": "veo:svc:web-app",
  "veo-app-id": "hazard",
};

export async function fetchVeoHighlights(slug: string): Promise<VeoHighlight[]> {
  const params = new URLSearchParams();
  for (const field of [
    "id", "start", "tags", "videos", "duration",
    "should_render", "is_ai_generated", "comment",
  ]) {
    params.append("fields", field);
  }
  params.set("include_ai", "true");

  const res = await fetch(`${VEO_API}/${slug}/highlights/?${params}`, {
    headers: veoHeaders,
  });
  if (res.status === 404) throw new Error("Veo match not found");
  if (!res.ok) throw new Error(`Veo highlights failed (${res.status})`);

  const data: unknown = await res.json();
  if (!Array.isArray(data)) throw new Error("Unexpected Veo highlights response");
  return data as VeoHighlight[];
}

export function filterGoalHighlights(highlights: VeoHighlight[]): VeoHighlight[] {
  return highlights
    .filter((h) => h.tags?.some((t) => t.slug === "goal"))
    .filter((h) => h.videos?.[0]?.url)
    .filter((h) => h.should_render !== false)
    .sort((a, b) => a.start - b.start);
}
```

---

## 9. Related links

| Resource | URL |
|----------|-----|
| Veo marketing | https://www.veo.com/ |
| Veo app (example) | https://app.veo.co/matches/20260321-match-ksva-seniors-a-vee5ec95/ |
| Goal highlights feature | [goal-highlights.md](./goal-highlights.md) |
