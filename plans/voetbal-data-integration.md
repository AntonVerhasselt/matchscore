# VoetbalInBelgië data integration — implementation plan

> **Status:** **Complete** — Phases 0–10 done (posting pipeline still deferred)  
> **Branch:** `voetbal-data`  
> **Research:** [Documentation/voetbalinbelgie-api-research.md](../Documentation/voetbalinbelgie-api-research.md)  
> **Live API samples:** [Documentation/voetbalinbelgie-api-samples.md](../Documentation/voetbalinbelgie-api-samples.md)  
> **Season import runbook:** [Documentation/football-season-import.md](../Documentation/football-season-import.md)  
> **API terms:** VoetbalInBelgië API Handleiding (november 2025) — caching TTL in §4

---

## Progress at a glance

| Phase | Topic | Status |
|-------|--------|--------|
| **0** | Prerequisites & tooling | ✅ Done |
| **1** | Schema & validators | ✅ Done |
| **2** | API helpers & parsers | ✅ Done |
| **3** | DB write helpers & queries | ✅ Done |
| **4** | One-time club import | ✅ Done |
| **5** | Competition sync + cron | ✅ Done |
| **6** | Organisation linking | ✅ Done |
| **7** | UI integration | ✅ Done |
| **8** | Template render bridge | ✅ Done |
| **9** | Testing & observability | ✅ Done — 106 unit tests; structured sync logs in Convex |
| **10** | Documentation | ✅ Done |

**Legend:** ✅ Done · 🟡 Partial · ⬜ Not started

---

## Executive summary

Matchscore integrates Belgian amateur football data in **two separate pipelines**:

1. **Club import (static)** — Public HTML from voetbalinbelgie.be → `footballTeams` + logos. Run at season start and after parser fixes. **Implemented.**
2. **Competition sync (dynamic)** — Authenticated JSON API → `competitions`, `competitionStandings`, `matches` only. Never touches teams or logos. **Implemented.**

Every organisation must link to a `footballTeamId` at creation; org name = team display name. Landing search, onboarding, calendar, settings team change, and template preview/render test all use real synced match data when available. Forced sync runs on org create and team change; a 15-minute cron keeps linked competitions fresh.

---

## Decisions log (confirmed)

| Topic | Decision |
|-------|----------|
| **Organisation name** | Always the selected **team `name`** (display name, e.g. `KSV Aartselaar` or `ASV Geel Dames`). No free-text club name on onboarding. |
| **`footballTeamId` on create** | **Required** on `createOrganization`. No org without a linked team. |
| **One-time vs sync endpoints** | Public HTML **only** for club import. Sync uses **only** `GET api.voetbalinbelgie.be/competities/…/`. |
| **Sync writes** | Updates **`competitions`**, **`competitionStandings`**, **`matches`** only. |
| **Logos** | Imported once from club pages → Convex `_storage`. Sync ignores logo fields from competition JSON. |
| **Team lookup during sync** | Resolve via `(sourceCompetitionId, vibTeamName)`. Missing team → sync **fails** for that competition. |
| **Pre-sync validation** | `pnpm test:football-pre-sync` — all allowlisted competition teams must exist in DB before sync is safe. |
| **Duplicate display names** | Same club, same VIB name (e.g. men + women both “ASV Geel”) → first unchanged, women get ` Dames`, reserve men get ` B`. `vibTeamName` stays the API name. |
| **Allowlist gap** | Registration always allowed. Non-allowlisted competitions: sync skipped; **calendar page only** shows future-access message. |
| **First sync on signup** | **Force** API call when org links allowlisted competition (bypass TTL). **Implemented** in `createOrganization`. |
| **Change team in Settings** | Any org member can change team; org **slug unchanged**, **name** updates; triggers forced re-sync. **Implemented** in `updateOrganizationFootballTeam`. |
| **Org ↔ team cardinality** | One org → one team. Unique index `organizations.by_footballTeamId`. |
| **API cache TTL** | VoetbalInBelgië Handleiding §4; `Europe/Brussels`; helper in `syncSchedule.ts`. |
| **Period rankings** | Not stored. |
| **Timezone for TTL** | `Europe/Brussels` |
| **Template sample match (announcement)** | Next future fixture; if none, most recent past |
| **Template sample match (result)** | Most recent played match (with scores) |
| **No synced match for render/preview** | Fall back to `DEFAULT_MOCK_MATCH` |
| **Score binding** | Numeric `homeGoals - awayGoals`; use `resultText` when status ≠ `Gespeeld` |
| **`matchAddress` format** | Home team address: `"street, postalCode city"` |
| **Missing opponent logo** | Empty/transparent box (server + editor preview) |

---

## Data lifecycle (two pipelines)

```text
┌─────────────────────────────────────────────────────────────────┐
│ CLUB IMPORT (static) — public HTML only              ✅ DONE     │
│ pnpm import:football-clubs        # incremental                 │
│ pnpm import:football-clubs:full   # season rollover             │
│   stamnummers → club pages → footballTeams + logos              │
│   + disambiguate display names + repair + pre-sync validation   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ COMPETITION SYNC (dynamic) — JSON API only          ✅ DONE     │
│ syncCompetition / cron syncLinkedCompetitions (15 min)          │
│   competition endpoint → competitions + standings + matches     │
│   (never footballTeams, never logos, never public HTML)         │
│   forced sync on org create + settings team change              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase 0 — Prerequisites & tooling ✅

| Item | Status | Notes |
|------|--------|-------|
| `VOETBALINBELGIE_API_KEY` on Convex deployment | ✅ | Required for sync + `test:football-pre-sync` |
| `pnpm test:voetbalinbelgie-api` | ✅ | Regenerates sample MD |
| HTML parsing | ✅ | Regex-based parsers in `convex/lib/voetbalinbelgie/parseHtml.ts` (no cheerio) |
| Folder layout | ✅ | See **Actual layout** below |

### Actual layout (as built)

```text
convex/
├── lib/voetbalinbelgie/          # Pure functions + unit tests
│   ├── allowlist.ts
│   ├── disambiguateTeamNames.ts
│   ├── parseHtml.ts
│   ├── parseCompetition.ts
│   ├── syncSchedule.ts
│   ├── teamNames.ts
│   ├── vibMatchKey.ts
│   └── types.ts
├── voetbalinbelgie/
│   ├── fetch.ts
│   └── logos.ts
├── football/
│   ├── queries.ts
│   ├── actions.ts
│   ├── importClubPage.ts
│   ├── internalMutations.ts
│   ├── internalActions.ts         # importClubBatch, repair
│   ├── internalQueries.ts
│   ├── syncActions.ts             # syncCompetition, syncLinkedCompetitions
│   ├── runSyncCompetition.ts      # core sync orchestration
│   ├── helpers.ts
│   ├── logoImport.ts
│   └── validators.ts
└── crons.ts                       # 15 min → syncLinkedCompetitions

components/
├── football/
│   ├── FootballTeamSearch.tsx
│   └── FootballTeamAvatar.tsx
├── calendar/
│   ├── CalendarPageContent.tsx
│   ├── FootballCalendar.tsx
│   ├── CalendarEventBar.tsx
│   ├── CalendarSkeleton.tsx
│   └── MatchList.tsx
├── template-editor/
│   └── preview-match-context.tsx
└── settings/
    └── LinkedTeamSettings.tsx

lib/
├── calendar/
│   ├── calendar-events.ts
│   └── month-grid.ts
├── football/
│   ├── build-template-match.ts
│   ├── format-team-address.ts
│   ├── select-sample-match.ts
│   ├── selected-team-storage.ts
│   └── template-render-match.ts
├── template-scene/
│   ├── template-match.ts
│   └── mock-match.ts              # DEFAULT_MOCK_MATCH fallback

scripts/
├── import-football-clubs.ts
├── test-football-pre-sync.ts
├── test-voetbalinbelgie-api.ts
├── diagnose-football-import.ts
└── seed-football-team.ts
```

---

## Phase 1 — Schema & validators ✅

All tables and indexes from the original plan are deployed:

- `footballTeams`, `competitions`, `competitionStandings`, `matches`
- `organizations.footballTeamId` **required**
- Extra indexes beyond original plan: `by_stamnummer_and_sourceCompetitionId`, `by_logoSourceUrl`

**Acceptance:** ✅ `npx convex dev` pushes schema without errors.

---

## Phase 2 — API helpers & parsers ✅

| Component | Status | Location |
|-----------|--------|----------|
| Allowlist (2a + 4a, 2025/26) | ✅ | `convex/lib/voetbalinbelgie/allowlist.ts` |
| Sync TTL schedule | ✅ | `syncSchedule.ts` + tests |
| Fetch layer | ✅ | `convex/voetbalinbelgie/fetch.ts` |
| HTML parsers | ✅ | `parseHtml.ts` + tests |
| JSON parser | ✅ | `parseCompetition.ts` + tests |
| Helpers | ✅ | `football/helpers.ts` |
| Logo normalisation | ✅ | `convex/voetbalinbelgie/logos.ts` |
| Display name disambiguation | ✅ | `disambiguateTeamNames.ts` + tests |

**Acceptance:** ✅ Unit tests pass (`pnpm test`).

---

## Phase 3 — Database write helpers & queries ✅

### Internal mutations (implemented)

| Mutation | Used by | Status |
|----------|---------|--------|
| `upsertFootballTeam` | Import | ✅ |
| `upsertCompetition` | Sync | ✅ |
| `replaceCompetitionStandings` | Sync | ✅ |
| `upsertMatch` / `mergeCompetitionMatches` | Sync | ✅ |
| `patchCompetitionSyncStatus` | Sync | ✅ |
| `dedupeOrphanFootballTeams` | Import repair | ✅ |
| `repairDuplicateTeamDisplayNames` | Import / season repair | ✅ |

### Queries (implemented)

| Query | Auth | Status |
|-------|------|--------|
| `searchFootballTeams` | Public | ✅ incl. `logoUrl` |
| `getFootballTeamForSelection` | Public | ✅ onboarding restore |
| `getFootballTeam` | Member | ✅ |
| `listTeamMatches` | Member | ✅ incl. opponent name/logo, match status |
| `getCompetitionStandings` | Member | ✅ |
| `getCalendarAccessStatus` | Member | ✅ wired to calendar UI |

---

## Phase 4 — One-time club import ✅

| Item | Status | Notes |
|------|--------|-------|
| `importAllClubs` + batched `importClubBatch` | ✅ | 50 clubs/batch, 100 ms delay |
| `importClubPage` | ✅ | Sets `name` (display) + `vibTeamName` (API) |
| Logo download + dedupe | ✅ | `logoImport.ts` |
| `repairMissingCompetitionTeams` | ✅ | End of import chain + manual |
| CLI scripts | ✅ | See command table below |
| Pre-sync validation | ✅ | `pnpm test:football-pre-sync` |

Full checklist: [Documentation/football-season-import.md](../Documentation/football-season-import.md).

---

## Phase 5 — Competition sync ✅

### 5.1 `syncCompetition` — `convex/football/syncActions.ts` + `runSyncCompetition.ts`

```
1. If !isCompetitionPathAllowed(path) → return { status: "skipped", reason: "not_allowlisted" }
2. Load competition row; if !shouldFetchCompetition(lastSyncedAt, now, { force }) → return { status: "skipped", reason: "ttl" }
3. json ← fetchCompetitionJson(path)
4. dto ← parseCompetitionJson(json)
5. validateCompetitionTeamsImported(ctx, dto)
6. upsertCompetition(dto.meta, path)
7. replaceCompetitionStandings(competitionId, dto.leaguetable)
8. mergeCompetitionMatches → upsertMatch for each
9. patchCompetitionSyncStatus({ lastSyncedAt: now, lastSyncError: undefined })
```

On failure: set `lastSyncError`, do **not** update `lastSyncedAt`.

**Does not:** upsert teams, download logos, or fetch public HTML.

### 5.2 `syncLinkedCompetitions`

Distinct `competitionPath` values from orgs' linked teams → `syncCompetition({ force: false })`.

### 5.3 `convex/crons.ts`

15-minute interval → `syncLinkedCompetitions`. HTTP gated by `shouldFetchCompetition`.

### 5.4 Acceptance

- [x] Sync 2a updates standings + matches; `footballTeams` count unchanged
- [x] Second sync within TTL skips HTTP
- [x] `force: true` bypasses TTL
- [x] Missing team → `lastSyncError`
- [x] Non-allowlisted path → `skipped: "not_allowlisted"`
- [x] Automated tests in `convex/footballSync.test.ts`

---

## Phase 6 — Organisation linking ✅

| Item | Status |
|------|--------|
| `createOrganization({ footballTeamId })` only | ✅ |
| Org `name` = `team.name` | ✅ |
| Unique team ↔ org check | ✅ |
| Schedule `syncCompetition({ force: true })` on create | ✅ |
| `updateOrganizationFootballTeam` (Settings) | ✅ — any member; slug unchanged |
| Invitation inherits org team (no onboarding) | ✅ |

---

## Phase 7 — UI integration ✅

| Surface | Status | Notes |
|---------|--------|-------|
| **Landing hero search** | ✅ | `FootballTeamSearch` — white bar in dark mode; logo + name dropdown |
| **Onboarding** | ✅ | Pre-fill from sessionStorage; confirm card |
| **Settings — linked team** | ✅ | `LinkedTeamSettings` — display + change team |
| **Calendar page** | ✅ | Month grid, green match bars, blue automation bars, match list, skeleton while sync pending |
| Allowlist warnings on landing/onboarding | ✅ | Correctly omitted per decision |

### Calendar UI behaviour

- **Month grid** — navigate months; match days show green bars with opponent logo
- **Automation bars** — blue bars when global automations enabled: announcement 2 days before match, result on match day
- **Match list** — chronological list below calendar with status badges (e.g. Gespeeld / Gepland)
- **Access states** — see Testing guide section F

---

## Phase 8 — Template render integration ✅

- [x] `TemplateMatchDto` / `TemplateRenderMatchData` from `matches` + joined `footballTeams`
- [x] `matchAddress` from home team's imported address (`lib/football/format-team-address.ts`)
- [x] `getTemplateRenderMatchData` query — sample match per automation type
- [x] Server **Render test** uses real data (`renderTemplateTest` → `buildTemplateMatch`)
- [x] Editor **Preview mode** uses same query via `PreviewMatchProvider` + `resolveTextContent` / `resolveImageSource`
- [x] Club logos loaded from Convex `_storage` at render time; missing logo → empty box

### Sample match selection

| `automationType` | Rule |
|------------------|------|
| `match_announcement` | Next `kickoffAt >= now`; else most recent past |
| `match_result` | Most recent played match (`homeGoals` + `awayGoals` defined) |

Fallback when no match: `DEFAULT_MOCK_MATCH` (non-allowlisted orgs, pre-sync, empty calendar).

### Key files

| File | Role |
|------|------|
| `lib/football/select-sample-match.ts` | Pure match picker |
| `lib/football/build-template-match.ts` | DB rows → `TemplateMatchDto` |
| `convex/football/queries.ts` → `getTemplateRenderMatchData` | Auth-scoped sample for org team |
| `convex/automations/actions.ts` → `renderTemplateTest` | Server PNG with real bindings |
| `components/template-editor/preview-match-context.tsx` | Client preview context |
| `lib/template-scene/index.ts` | `resolveTextContent` / `resolveImageSource` with live data |
| `convex/automations/render/hydrate_scene.ts` | Logo buffers via `loadTeamLogo` |

---

## Phase 9 — Testing & observability ✅

### Automated (done)

| Test | Location |
|------|----------|
| HTML / JSON parsers | `convex/lib/voetbalinbelgie/*.test.ts` |
| TTL schedule | `syncSchedule.test.ts` |
| Upsert / standings / matches | `convex/footballInternalMutations.test.ts` |
| Display name disambiguation | `disambiguateTeamNames.test.ts` |
| Sync orchestration | `convex/footballSync.test.ts` |
| Internal sync queries | `convex/footballInternalQueries.test.ts` |
| Org team change effects | `convex/organizationsUpdateFootballTeam.test.ts` |
| Calendar event building | `lib/calendar/calendar-events.test.ts` |
| Allowlist pre-sync | `pnpm test:football-pre-sync` |
| Template match builder / picker / address | `lib/football/*.test.ts`, `lib/template-scene/format-binding.test.ts` |
| Server render with real logo buffers | `convex/automations/render/render.test.ts` |

**Current count:** 106 tests, all passing (`pnpm test`).

### Observability

Structured JSON `console.log` events in Convex logs:

- `football_competition_sync` / `football_competition_sync_error`
- `football_linked_competitions_sync`

External alerting deferred; Convex dashboard logs sufficient for now.

---

## Phase 10 — Documentation ✅

| Doc | Status |
|-----|--------|
| [football-season-import.md](../Documentation/football-season-import.md) | ✅ Season import runbook |
| [voetbalinbelgie-api-research.md](../Documentation/voetbalinbelgie-api-research.md) | ✅ Sync behaviour aligned with implementation |
| [organisations.md](../Documentation/organisations.md) | ✅ Mandatory `footballTeamId`, team search onboarding, settings team change |
| [automations-and-templates.md](../Documentation/automations-and-templates.md) | ✅ Real match data in preview + render test |
| [template-editor.md](../Documentation/template-editor.md) | ✅ Preview mode + server render pipeline |
| This plan | ✅ Kept current |

---

## Remaining work — post-integration

| Area | Notes |
|------|-------|
| **Posting pipeline** | Cron, template pick, Meta/social APIs — out of scope for this plan |
| **External sync alerting** | Optional PostHog/Sentry on `football_competition_sync_error` |
| **New template bindings** | e.g. `matchStatus`, competition title — product decision |

---

## Definition of done

### Done ✅

- [x] Club import populates teams + logos
- [x] Pre-sync test passes for 2a + 4a
- [x] `createOrganization({ footballTeamId })` required; org name = team name
- [x] Landing search + onboarding team selection
- [x] Duplicate display names disambiguated
- [x] Season import runbook documented
- [x] Competition sync updates standings + matches only
- [x] TTL respected; force sync on signup / settings team change
- [x] Cron every 15 min with HTTP gating
- [x] Calendar page shows matches or allowlist/sync status messages
- [x] Settings allows changing linked team
- [x] Template editor preview mode uses real match data
- [x] Render test uses real match data (fallback to mock when none)
- [x] Org/automation documentation updated

### Deferred (outside football data integration) ⬜

- [ ] Scheduled posting pipeline (cron + social OAuth)
- [ ] External observability alerting

### Former gaps — now done ✅

- [x] Template automations render with real match data (Phase 8)
- [x] Org/automation documentation updated (Phase 10)

---

## Risk register

| Risk | Mitigation |
|------|------------|
| Team name mismatch import ↔ API | ✅ Pre-sync validation; repair scripts |
| HTML layout changes | JSON-LD + fixture tests; parser fixes |
| API blocking from over-fetch | ✅ TTL helper + cron gating |
| Duplicate men/women names in search | ✅ `disambiguateTeamNames` + repair mutation |
| Stale teams after season rollover | Full import + document stale-row review |
| User picks non-allowlisted team | Org created; calendar shows friendly message; sync skipped |
| **Existing orgs before sync deploy** | Manual one-time sync (see Testing guide G) |

---

## Out of scope

- Social OAuth posting pipeline
- Period rankings
- Org deletion → stop sync edge case
- Updating club/team records or logos after import (except re-import)
- Public HTML calls during sync
- Admin UI for allowlist (code constant for now)

---

## Testing guide

Use this to verify the full integration on local dev.

### A. Prerequisites

1. **Start dev servers** (Convex + Next.js):

   ```bash
   pnpm install
   cp .env.example .env.local   # if first time
   pnpm dev
   ```

   Keep both processes running. Convex must deploy functions successfully — if `npx convex dev` shows TypeScript errors, sync will not work.

2. **Convex env vars** (once per deployment):

   ```bash
   npx convex env set BETTER_AUTH_SECRET "$(openssl rand -base64 32)"
   npx convex env set SITE_URL http://localhost:3000
   npx convex env set VOETBALINBELGIE_API_KEY "your-key"
   ```

3. **Import football data** (skip if already imported and stable):

   ```bash
   pnpm test                                    # 106 tests, all should pass
   pnpm import:football-clubs:full              # or incremental if recently run
   npx convex run football/internalQueries:countFootballTeams '{}'
   pnpm test:football-pre-sync                  # must pass
   ```

   For quick onboarding-only testing without full import:

   ```bash
   pnpm seed:football-team                      # seeds KSV Aartselaar on dev
   ```

### B. Automated commands (run in order)

```bash
pnpm test
pnpm test:football-pre-sync
pnpm repair:football-team-names    # expect updated: 0 if already run
```

Optional spot checks:

```bash
npx convex run football/queries:searchFootballTeams '{"query":"Aartselaar"}'
npx convex run football/queries:searchFootballTeams '{"query":"ASV Geel"}'
tsx scripts/diagnose-football-import.ts
```

**Expected:** `ASV Geel` search returns two rows — `ASV Geel` and `ASV Geel Dames`, each with `logoUrl`.

### C. UI walkthrough — landing & onboarding (http://localhost:3000)

Use a **fresh email** (or `pnpm db:clear-dev` first — preserves club import) for the full signup path. Resend test mode accepts addresses like `delivered@resend.dev`.

#### 1. Landing — hero search

| Step | Action | Expected |
|------|--------|----------|
| 1 | Open `/` in dark mode | Hero loads; search bar has **white/cream background** with dark text (matches hero headline contrast) |
| 2 | Type `Aart` (≥2 chars) | Dropdown opens; max ~5 visible rows, scroll for more |
| 3 | Inspect dropdown rows | Club **logo + name only**; normal font weight |
| 4 | Search `ASV Geel` | Two distinct options: **ASV Geel** and **ASV Geel Dames** |
| 5 | Click a club | Redirects to `/sign-in` |

#### 2. Sign-in without hero search

| Step | Action | Expected |
|------|--------|----------|
| 1 | Open `/sign-in` directly | OTP flow works |
| 2 | Complete OTP | Redirect to `/onboarding` with **search** (no pre-selected club) |

#### 3. Sign-in after hero search

| Step | Action | Expected |
|------|--------|----------|
| 1 | Select club on `/` → sign in | After OTP → `/onboarding` |
| 2 | Onboarding screen | **Confirmation card** with logo + club name |
| 3 | Click “Choose a different club” | Same search component as landing |
| 4 | Click Continue with **KSV Aartselaar** (2a allowlisted) | Org created → redirect to `/app`; forced sync scheduled |

#### 4. Onboarding validation

| Step | Action | Expected |
|------|--------|----------|
| 1 | On onboarding, click Continue without team | Error toast/alert |
| 2 | After success | Organisation name in app = selected team display name |

#### 5. Invitation path (optional)

| Step | Action | Expected |
|------|--------|----------|
| 1 | Existing member invites new email | Invitation email (test address) |
| 2 | Invitee signs in via link | Lands on `/app` — **skips onboarding** |

### D. Calendar page (`/app`)

Sign in as an org linked to an **allowlisted** team (e.g. KSV Aartselaar in Antwerp 2a).

#### Initial load — sync pending

| Step | Action | Expected |
|------|--------|----------|
| 1 | Open `/app` immediately after creating org | **Skeleton** (pulsing calendar placeholder) while sync runs |
| 2 | Wait 5–30 seconds | Calendar loads with month grid |

If skeleton persists for more than ~1 minute, check Convex logs (section G).

#### After sync completes

| Step | Action | Expected |
|------|--------|----------|
| 1 | View current month | Days with matches show **green bars** with opponent logo |
| 2 | Navigate to a month with fixtures (e.g. April 2026) | Multiple match bars visible |
| 3 | Scroll to match list below calendar | Chronological list with opponent names, scores (if played), status badges |
| 4 | Enable global automations in `/app/automations` | Return to calendar — **blue bars** appear: announcement 2 days before match, result on match day |
| 5 | Disable automations | Blue bars disappear; green match bars remain |

#### Non-allowlisted team

Create an org with a team **outside** the allowlist (any team not in 2a or 4a):

| Step | Action | Expected |
|------|--------|----------|
| 1 | Open `/app` | Friendly alert: calendar/API access not available yet for this competition |
| 2 | No skeleton loop | Message shows immediately (no sync attempted) |

### E. Settings — linked team (`/app/settings`)

| Step | Action | Expected |
|------|--------|----------|
| 1 | Open Settings | **Linked team** card shows current team logo + name + competition info |
| 2 | Click “Team wijzigen” / change team | Search input appears |
| 3 | Search and select a different team | Save + Cancel buttons appear |
| 4 | Click Cancel | Returns to display mode; team unchanged |
| 5 | Select new team → Save | Success toast; org **name** updates to new team; **slug unchanged** |
| 6 | Return to `/app` | Calendar reflects new team's matches (after sync completes) |
| 7 | Try selecting a team already linked to another org | Error toast |

### F. Calendar access states (reference)

| `messageKey` | UI | When |
|--------------|-----|------|
| `calendar_available` | Full calendar + match list | Sync succeeded |
| `calendar_sync_pending` | Skeleton (if no cached matches) | First sync in progress |
| `calendar_sync_error` | Error alert; stale data shown if any | Missing teams or API failure |
| `calendar_not_allowlisted` | Friendly “not available yet” alert | Team competition outside allowlist |
| `calendar_no_competition` | Alert | Team has no `competitionPath` |

### G. Manual sync & troubleshooting

**Existing orgs** created before sync was deployed have no matches until synced once:

```bash
npx convex run football/syncActions:syncCompetition \
  '{"path":"/competities/2025-2026/antwerpen/mannen/2a/","force":true}'
```

**Expected output:** `{ "status": "synced", "path": "...", "matchCount": ~240 }` (exact count varies).

Verify in Convex dashboard:

1. **`competitions`** — row for 2a path with recent `lastSyncedAt`, no `lastSyncError`
2. **`matches`** — hundreds of rows for that competition
3. **`competitionStandings`** — ~16–20 rows per competition
4. **`footballTeams`** — count **unchanged** after sync

**Cron:** runs every 15 minutes. Second sync within TTL should skip HTTP (`status: "skipped", reason: "ttl"`). Check Convex **Logs** for `football_linked_competitions_sync` JSON events.

**Common issues:**

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Calendar stuck on skeleton | Sync not deployed or failed | `npx convex dev --once`; run manual sync; check logs |
| `lastSyncError` about missing team | Import incomplete for that competition | `pnpm repair:football-teams` then re-sync |
| Empty calendar after sync | Wrong team / no matches in selected month | Navigate to months with fixtures |
| 401 from API | Missing/invalid `VOETBALINBELGIE_API_KEY` | Set env var on deployment |

### H. Convex dashboard checks

After import + sync:

1. **`footballTeams`** — ~2 600+ documents; sample has `name`, `vibTeamName`, `competitionPath`, `logoStorageId`
2. **`organizations`** — `footballTeamId` set on all orgs
3. **`competitions`** — one row per synced allowlisted path
4. **`matches`** — populated for synced competitions

### I. Automations — preview & render test

| Area | Route / control | Expected |
|------|-----------------|----------|
| Editor preview mode | Toolbar “Preview” toggle | Real club names, date, address, logos from synced matches |
| Render test | Toolbar “Render test” | Server PNG with same sample match rules |
| Announcement sample | `match_announcement` | Next future match, else latest past |
| Result sample | `match_result` | Latest played match with score |
| No synced matches | Either surface | Falls back to `DEFAULT_MOCK_MATCH` |

Verify: open template editor for an allowlisted team with synced calendar → toggle Preview → bindings show your fixtures, not “KFC Eendracht”.

---

## Command reference (quick copy)

```bash
# Dev servers
pnpm dev

# Tests & validation
pnpm test
pnpm test:football-pre-sync
pnpm test:voetbalinbelgie-api

# Import & repair
pnpm import:football-clubs
pnpm import:football-clubs:full
pnpm repair:football-teams
pnpm repair:football-team-names

# Manual sync (allowlisted path)
npx convex run football/syncActions:syncCompetition \
  '{"path":"/competities/2025-2026/antwerpen/mannen/2a/","force":true}'

# Inspect
npx convex run football/internalQueries:countFootballTeams '{}'
npx convex run football/queries:searchFootballTeams '{"query":"Geel"}'

# Reset dev data (keeps footballTeams import)
pnpm db:clear-dev
pnpm seed:football-team
```
