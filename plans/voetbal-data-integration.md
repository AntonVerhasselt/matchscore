# VoetbalInBelgië data integration — implementation plan

> **Status:** **In progress** — Phases 0–4 complete; Phase 6 partial; Phases 5, 7–10 mostly open  
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
| **5** | Competition sync + cron | ⬜ **Not started** |
| **6** | Organisation linking | 🟡 **Partial** — `createOrganization` done; sync trigger + settings change missing |
| **7** | UI integration | 🟡 **Partial** — landing + onboarding done; settings + calendar UI missing |
| **8** | Template render bridge | ⬜ **Not started** |
| **9** | Testing & observability | 🟡 **Partial** — import/parser tests done; sync tests missing |
| **10** | Documentation | 🟡 **Partial** — season runbook done; org/automation docs not updated |

**Legend:** ✅ Done · 🟡 Partial · ⬜ Not started

---

## Executive summary

Matchscore integrates Belgian amateur football data in **two separate pipelines**:

1. **Club import (static)** — Public HTML from voetbalinbelgie.be → `footballTeams` + logos. Run at season start and after parser fixes. **Implemented.**
2. **Competition sync (dynamic)** — Authenticated JSON API → `competitions`, `competitionStandings`, `matches` only. Never touches teams or logos. **Not implemented yet.**

Every organisation must link to a `footballTeamId` at creation; org name = team display name. Landing search and onboarding are wired; calendar, settings team change, sync, and template render bridge are next.

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
| **First sync on signup** | **Force** API call when org links allowlisted competition (bypass TTL). **Planned — not wired yet.** |
| **Change team in Settings** | Allowed; triggers forced re-sync for new competition. **Planned — not implemented yet.** |
| **Org ↔ team cardinality** | One org → one team. Unique index `organizations.by_footballTeamId`. |
| **API cache TTL** | VoetbalInBelgië Handleiding §4; `Europe/Brussels`; helper in `syncSchedule.ts` (**implemented**, used when sync lands). |
| **Period rankings** | Not stored. |
| **Timezone for TTL** | `Europe/Brussels` |

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
│ COMPETITION SYNC (dynamic) — JSON API only          ⬜ TODO     │
│ syncCompetition / cron syncLinkedCompetitions                   │
│   competition endpoint → competitions + standings + matches     │
│   (never footballTeams, never logos, never public HTML)         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase 0 — Prerequisites & tooling ✅

| Item | Status | Notes |
|------|--------|-------|
| `VOETBALINBELGIE_API_KEY` on Convex deployment | ✅ | Required for `test:football-pre-sync` |
| `pnpm test:voetbalinbelgie-api` | ✅ | Regenerates sample MD |
| HTML parsing | ✅ | Regex-based parsers in `convex/lib/voetbalinbelgie/parseHtml.ts` (no cheerio) |
| Folder layout | ✅ | See **Actual layout** below |

### Actual layout (as built)

```text
convex/
├── lib/voetbalinbelgie/          # Pure functions + unit tests
│   ├── allowlist.ts
│   ├── disambiguateTeamNames.ts   # Men / women duplicate names
│   ├── parseHtml.ts
│   ├── parseCompetition.ts
│   ├── syncSchedule.ts
│   ├── teamNames.ts
│   ├── vibMatchKey.ts
│   └── types.ts
├── voetbalinbelgie/
│   ├── fetch.ts                   # HTML + competition JSON fetch
│   └── logos.ts
├── football/
│   ├── queries.ts                 # Public + member queries
│   ├── actions.ts                 # importAllClubs kickoff
│   ├── importClubPage.ts
│   ├── internalMutations.ts
│   ├── internalActions.ts         # importClubBatch, repair (no sync yet)
│   ├── internalQueries.ts
│   ├── helpers.ts
│   ├── logoImport.ts
│   └── validators.ts
└── crons.ts                       # ⬜ Not created yet

scripts/
├── import-football-clubs.ts       # + --full for season rollover
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
| HTML parsers | ✅ | `parseHtml.ts` + tests (incl. panel-without-tabs fix) |
| JSON parser | ✅ | `parseCompetition.ts` + tests |
| Helpers | ✅ | `football/helpers.ts` — resolve, assert, upsert keys |
| Logo normalisation | ✅ | `convex/voetbalinbelgie/logos.ts` |
| Display name disambiguation | ✅ | `disambiguateTeamNames.ts` + tests |

**Acceptance:** ✅ Unit tests pass (`pnpm test`).

---

## Phase 3 — Database write helpers & queries ✅

### Internal mutations (implemented)

| Mutation | Used by | Status |
|----------|---------|--------|
| `upsertFootballTeam` | Import | ✅ |
| `upsertCompetition` | Sync (ready) | ✅ |
| `replaceCompetitionStandings` | Sync (ready) | ✅ |
| `upsertMatch` | Sync (ready) | ✅ |
| `patchCompetitionSyncStatus` | Sync (ready) | ✅ |
| `dedupeOrphanFootballTeams` | Import repair | ✅ |
| `repairDuplicateTeamDisplayNames` | Import / season repair | ✅ |

### Queries (implemented)

| Query | Auth | Status |
|-------|------|--------|
| `searchFootballTeams` | Public | ✅ incl. `logoUrl` |
| `getFootballTeamForSelection` | Public | ✅ onboarding restore |
| `getFootballTeam` | Member | ✅ |
| `listTeamMatches` | Member | ✅ (no sync data yet) |
| `getCompetitionStandings` | Member | ✅ (no sync data yet) |
| `getCalendarAccessStatus` | Member | ✅ (UI not wired) |

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
| Orphan upgrade / panel-without-tabs | ✅ | Parser + repair pipeline |

### Commands

| Command | When |
|---------|------|
| `pnpm import:football-clubs` | Incremental — skips clubs that look complete |
| `pnpm import:football-clubs:full` | **Season rollover** — re-fetch every club |
| `pnpm repair:football-teams` | Missing teams in allowlisted competitions |
| `pnpm repair:football-team-names` | Duplicate men/women display names |
| `pnpm test:football-pre-sync` | Validate allowlisted API ↔ DB |

Full checklist: [Documentation/football-season-import.md](../Documentation/football-season-import.md).

### Acceptance

- ✅ ~2 600+ `footballTeams` rows (~1 600 clubs, multiple teams per club)
- ✅ KSV Aartselaar + KSV Aartselaar B with correct paths and `vibTeamName`
- ✅ Logos in `_storage`
- ✅ Pre-sync passes for Antwerp 2a (389) and 4a (394)
- ✅ ASV Geel / ASV Geel Dames disambiguation

---

## Phase 5 — Competition sync ⬜ NOT STARTED

**This is the next major backend phase.** Helpers and mutations exist; orchestration does not.

### 5.1 To implement: `internalActions.syncCompetition`

```
1. If !isCompetitionPathAllowed(path) → return { skipped: "not_allowlisted" }
2. Load competition row; if !shouldFetchCompetition(lastSyncedAt, now, { force }) → return { skipped: "ttl" }
3. json ← fetchCompetitionJson(path)
4. dto ← parseCompetitionJson(json)
5. assertAllCompetitionTeamsImported(ctx, dto)
6. upsertCompetition(dto.meta, path)
7. replaceCompetitionStandings(competitionId, dto.leaguetable)
8. for each match in [...dto.results, ...dto.program]: upsertMatch(…)
9. patchCompetitionSyncStatus({ lastSyncedAt: now, lastSyncError: undefined })
```

On failure: set `lastSyncError`, do **not** update `lastSyncedAt`.

**Must not:** upsert teams, download logos, or fetch public HTML.

### 5.2 To implement: `syncLinkedCompetitions`

Distinct `competitionPath` values from orgs' linked teams → `syncCompetition({ force: false })`.

### 5.3 To implement: `convex/crons.ts`

15-minute interval → `syncLinkedCompetitions`. HTTP gated by `shouldFetchCompetition`.

### 5.4 Acceptance (when built)

- [ ] Sync 2a updates standings + matches; `footballTeams` count unchanged
- [ ] Second sync within TTL skips HTTP
- [ ] `force: true` bypasses TTL
- [ ] Missing team → `lastSyncError`
- [ ] Non-allowlisted path → `skipped: "not_allowlisted"`

---

## Phase 6 — Organisation linking 🟡 PARTIAL

| Item | Status |
|------|--------|
| `createOrganization({ footballTeamId })` only | ✅ |
| Org `name` = `team.name` | ✅ |
| Unique team ↔ org check | ✅ |
| Schedule `syncCompetition({ force: true })` on create | ⬜ |
| `updateOrganizationFootballTeam` (Settings) | ⬜ |
| Invitation inherits org team (no onboarding) | ✅ |

---

## Phase 7 — UI integration 🟡 PARTIAL

| Surface | Status | Notes |
|---------|--------|-------|
| **Landing hero search** | ✅ | `FootballTeamSearch` — logo + name dropdown; select → sign-in |
| **Onboarding** | ✅ | Pre-fill from sessionStorage; confirm card; shared search component |
| **Settings — linked team** | ⬜ | Display team + change team |
| **Calendar page** | ⬜ | Stub at `/app`; queries exist but UI not wired |
| Allowlist warnings on landing/onboarding | ✅ | Correctly omitted per decision |

---

## Phase 8 — Template render integration ⬜ NOT STARTED

- [ ] Build `MatchDto` from `matches` + joined `footballTeams` (logos from import)
- [ ] `matchAddress` from home team's imported address
- [ ] Replace `MockMatchDto` in automation render path

---

## Phase 9 — Testing & observability 🟡 PARTIAL

### Automated (done)

| Test | Location |
|------|----------|
| HTML / JSON parsers | `convex/lib/voetbalinbelgie/*.test.ts` |
| TTL schedule | `syncSchedule.test.ts` |
| Upsert / standings / matches | `convex/footballInternalMutations.test.ts` |
| Display name disambiguation | `disambiguateTeamNames.test.ts` |
| Allowlist pre-sync | `pnpm test:football-pre-sync` |

### Automated (todo — after Phase 5)

| Test | Purpose |
|------|---------|
| Sync does not mutate teams | Team count unchanged after sync |
| TTL skip / force bypass | HTTP call gating |
| Idempotent match upsert | Same `vibMatchKey` updates scores |
| Allowlist skip | No HTTP for non-allowlisted path |

### Manual QA

See **Testing guide** section below and [football-season-import.md](../Documentation/football-season-import.md).

---

## Phase 10 — Documentation 🟡 PARTIAL

| Doc | Status |
|-----|--------|
| [football-season-import.md](../Documentation/football-season-import.md) | ✅ Season import runbook |
| [voetbalinbelgie-api-research.md](../Documentation/voetbalinbelgie-api-research.md) | 🟡 Updated links; sync section describes planned behaviour |
| [organisations.md](../Documentation/organisations.md) | ⬜ Update for mandatory `footballTeamId` |
| [automations-and-templates.md](../Documentation/automations-and-templates.md) | ⬜ Real match data / render bridge |
| This plan | ✅ Kept current |

---

## Remaining work — recommended order

| Step | Deliverable | Depends on |
|------|-------------|------------|
| **1** | `syncCompetition` + `syncLinkedCompetitions` | Phase 4 import complete |
| **2** | `convex/crons.ts` (15 min tick) | Step 1 |
| **3** | Wire forced sync on `createOrganization` + `updateOrganizationFootballTeam` | Step 1 |
| **4** | Calendar page UI (`listTeamMatches`, `getCalendarAccessStatus`) | Step 1 |
| **5** | Settings — display + change linked team | Step 3 |
| **6** | Template render bridge (`MatchDto` from DB) | Step 1 |
| **7** | Sync integration tests + structured logging | Step 1 |
| **8** | Update org/automation docs | Steps 3–6 |

**Rough estimate for remaining work:** ~6–8 dev days.

---

## Definition of done

### Done today ✅

- [x] Club import populates teams + logos (`pnpm import:football-clubs:full`)
- [x] Pre-sync test passes for 2a + 4a
- [x] `createOrganization({ footballTeamId })` required; org name = team name
- [x] Landing search + onboarding team selection (no double entry)
- [x] Duplicate display names disambiguated (e.g. ASV Geel Dames)
- [x] Season import runbook documented

### Still required for full integration ⬜

- [ ] Competition sync updates standings + matches only
- [ ] TTL respected; force sync on signup / settings team change
- [ ] Cron every 15 min with HTTP gating
- [ ] Calendar page shows matches or allowlist/sync status messages
- [ ] Settings allows changing linked team
- [ ] Template automations render with real match data

---

## Risk register

| Risk | Mitigation |
|------|------------|
| Team name mismatch import ↔ API | ✅ Pre-sync validation; repair scripts |
| HTML layout changes | JSON-LD + fixture tests; parser fixes (e.g. panel-without-tabs) |
| API blocking from over-fetch | TTL helper ready; apply when sync ships |
| Duplicate men/women names in search | ✅ `disambiguateTeamNames` + repair mutation |
| Stale teams after season rollover | Full import + document stale-row review; dev reset via `db:clear-dev` (preserves clubs) |
| User picks non-allowlisted team | Org created; calendar page will explain; sync skipped |

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

Use this to verify everything that **is implemented today** on local dev.

### A. Prerequisites

1. **Start dev servers** (Convex + Next.js):

   ```bash
   pnpm install
   cp .env.example .env.local   # if first time
   pnpm dev
   ```

2. **Convex env vars** (once per deployment):

   ```bash
   npx convex env set BETTER_AUTH_SECRET "$(openssl rand -base64 32)"
   npx convex env set SITE_URL http://localhost:3000
   npx convex env set VOETBALINBELGIE_API_KEY "your-key"
   ```

3. **Import football data** (skip if already imported and stable):

   ```bash
   pnpm test                                    # unit tests
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

### C. UI walkthrough (http://localhost:3000)

Use a **fresh email** (or `pnpm db:clear-dev` first — preserves club import) for the full signup path. Resend test mode accepts addresses like `delivered@resend.dev`.

#### 1. Landing — hero search

| Step | Action | Expected |
|------|--------|----------|
| 1 | Open `/` | Hero loads with club search |
| 2 | Type `Aart` (≥2 chars) | Dropdown opens; max ~5 visible rows, scroll for more |
| 3 | Inspect dropdown rows | Club **logo + name only** (no competition path); normal font weight |
| 4 | Search `ASV Geel` | Two distinct options: **ASV Geel** and **ASV Geel Dames** |
| 5 | Click a club | Redirects to `/sign-in` (no separate “Try it out” button) |

#### 2. Sign-in without hero search

| Step | Action | Expected |
|------|--------|----------|
| 1 | Open `/sign-in` directly (skip hero) | OTP flow works |
| 2 | Complete OTP | Redirect to `/onboarding` with **search** (no pre-selected club) |

#### 3. Sign-in after hero search

| Step | Action | Expected |
|------|--------|----------|
| 1 | Select club on `/` → sign in | After OTP → `/onboarding` |
| 2 | Onboarding screen | **Confirmation card** with logo + club name (not search again) |
| 3 | Click “Choose a different club” | Same search component as landing |
| 4 | Click Continue | Org created → redirect to `/app` |

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

#### 6. App areas (post-integration gaps)

| Area | Route | Expected **today** |
|------|-------|-------------------|
| Calendar | `/app` | Placeholder header only — **no matches yet** (sync not built) |
| Settings | `/app/settings` | No linked-team display / change UI yet |
| Automations | `/app/automations` | Works with templates; render tests still use mock match data |

Do **not** treat missing calendar data as a regression until Phase 5 ships.

### D. Convex dashboard checks

After import, in [Convex dashboard](https://dashboard.convex.dev):

1. **`footballTeams`** — ~2 600+ documents; sample has `name`, `vibTeamName`, `competitionPath`, `logoStorageId`.
2. **`organizations`** — new signups have `footballTeamId` set.
3. **`competitions` / `matches`** — empty or stale until Phase 5 sync runs.

### E. When Phase 5 lands — extend testing

Add to this checklist:

- Create org with KSV Aartselaar (2a) → forced sync → `matches` populated
- Calendar page shows fixtures / results
- Non-allowlisted team → calendar shows “not available yet” message
- Change team in Settings → re-sync
- Wait for TTL window → cron sync without force

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

# Inspect
npx convex run football/internalQueries:countFootballTeams '{}'
npx convex run football/queries:searchFootballTeams '{"query":"Geel"}'

# Reset dev data (keeps footballTeams import)
pnpm db:clear-dev
pnpm seed:football-team
```
