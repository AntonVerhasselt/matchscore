# VoetbalInBelgië data integration — implementation plan

> **Status:** Plan only — no implementation yet  
> **Branch:** `voetbal-data`  
> **Research:** [Documentation/voetbalinbelgie-api-research.md](../Documentation/voetbalinbelgie-api-research.md)  
> **Live API samples:** [Documentation/voetbalinbelgie-api-samples.md](../Documentation/voetbalinbelgie-api-samples.md)  
> **API terms:** VoetbalInBelgië API Handleiding (november 2025) — caching TTL in §4

---

## Executive summary

This plan adds real Belgian amateur football data to Matchscore by:

1. **One-time import** (~1608 clubs/teams) from VoetbalInBelgië **public HTML** — static club/team records + logos in Convex storage.
2. **Ongoing sync** from the **authenticated competition JSON API only** — updates **standings + match calendar** for linked competitions; never touches club/team records or logos.
3. **Mandatory team link** — every organisation is created with a `footballTeamId`; organisation name is always the selected team name.

Estimated phases: **schema + parsers → one-time import → competition sync → org linking + TTL cron → UI search/onboarding**.

---

## Decisions log (confirmed)

| Topic | Decision |
|-------|----------|
| **Organisation name** | Always the selected **team name** (e.g. `KSV Aartselaar`). Remove free-text club name input from onboarding. |
| **`footballTeamId` on create** | **Required** on `createOrganization`. No org without a linked team. |
| **Existing orgs** | Not applicable — no production orgs; dev data can be wiped before rollout. |
| **One-time vs sync endpoints** | Public HTML endpoints used **only** by `import:football-clubs`. Sync uses **only** `GET api.voetbalinbelgie.be/competities/…/`. |
| **Sync writes** | Updates **`competitions` metadata**, **`competitionStandings`**, **`matches`** only. Does **not** create/update `footballTeams` or logos. |
| **Logos** | Imported once from public club pages → Convex `_storage`. Sync **ignores** logo fields from competition JSON. |
| **Team lookup during sync** | Resolve `home`/`away`/standing names to existing `footballTeams` via `(sourceCompetitionId, vibTeamName)`. Missing team → **sync fails** for that competition (with clear error log). |
| **Pre-sync validation** | Automated test + runtime check: all teams in a competition's `leaguetable` must already exist in `footballTeams` before sync is allowed. |
| **Allowlist gap** | Registration **always allowed**. If competition path is not allowlisted, sync is skipped silently. **Calendar page only** shows a message that calendar access is not available yet and will be added in the future. No message on landing or onboarding. |
| **First sync on signup** | **Bypasses API cache TTL** — always calls competition API immediately when org links an allowlisted competition. |
| **Change team after creation** | **Allowed in Settings** — changing `footballTeamId` triggers re-sync for the new team's competition (respecting allowlist + TTL for cron; immediate bypass for user-initiated change). |
| **Org ↔ team cardinality** | One org → one team. One team → one org (unique index on `organizations.by_footballTeamId`). |
| **API cache TTL** | Follow VIB API Handleiding §4 (see §5.3 below). Client-side cache via `competitions.lastSyncedAt`. |
| **Period rankings** | Not stored. |
| **Timezone for TTL** | `Europe/Brussels` |

---

## Data lifecycle (two pipelines)

```text
┌─────────────────────────────────────────────────────────────────┐
│ ONE-TIME (static) — public HTML only                            │
│ pnpm import:football-clubs                                      │
│   stamnummers → club pages → footballTeams + logos in storage   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ ONGOING (dynamic) — competition JSON API only                   │
│ syncCompetition / cron syncLinkedCompetitions                   │
│   competition endpoint → competitions + standings + matches     │
│   (never footballTeams, never logos, never public HTML)         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase 0 — Prerequisites & tooling (½ day)

### 0.1 Environment

- [ ] Confirm `VOETBALINBELGIE_API_KEY` in `.env.local` and Convex dashboard env vars.
- [ ] `pnpm test:voetbalinbelgie-api` regenerates sample MD (done).

### 0.2 Dependencies

- [ ] Add HTML parsing library: **`node-html-parser`** or **`cheerio`** (used only by one-time import actions).
- [ ] No extra deps for competition JSON parsing.

### 0.3 Folder layout

```text
convex/
├── voetbalinbelgie/
│   ├── types.ts
│   ├── allowlist.ts
│   ├── syncSchedule.ts         # TTL helper (API Handleiding §4)
│   ├── fetch.ts                # fetchCompetitionJson only for sync; HTML fetch for import
│   ├── parseHtml.ts            # Import-only
│   ├── parseCompetition.ts
│   └── logos.ts                # Import-only
├── football/
│   ├── queries.ts
│   ├── mutations.ts
│   ├── actions.ts              # importAllClubs (node)
│   ├── internalMutations.ts
│   ├── internalActions.ts      # syncCompetition, syncLinkedCompetitions
│   ├── helpers.ts              # vibMatchKey, resolveTeam, assertAllTeamsImported
│   └── validators.ts
├── crons.ts                    # 15-minute tick → syncLinkedCompetitions
└── lib/voetbalinbelgie/        # Pure functions + unit tests

scripts/
├── test-voetbalinbelgie-api.ts
└── import-football-clubs.ts
```

---

## Phase 1 — Schema & validators (1 day)

### 1.1 Extend `convex/schema.ts`

**New tables:** `footballTeams`, `competitions`, `competitionStandings`, `matches`

**Extend `organizations`:**

| Field | Type | Required |
|-------|------|----------|
| `footballTeamId` | `v.id("footballTeams")` | **Yes on insert** |

No optional `footballTeamId` — every org must have a team from day one.

### 1.2 Indexes

| Index | Used by |
|-------|---------|
| `footballTeams.by_competition_and_vibTeamName` | Sync team resolution |
| `footballTeams.by_stamnummer_and_name` | Import idempotency |
| `footballTeams.by_name` | Landing/onboarding search |
| `competitions.by_path` | Sync dedupe |
| `competitions.by_sourceCompetitionId` | Lookup |
| `matches.by_vibMatchKey` | Idempotent match upsert |
| `matches.by_competitionId_and_kickoffAt` | Calendar queries |
| `matches.by_homeTeamId_and_kickoffAt` | Org's team as home |
| `matches.by_awayTeamId_and_kickoffAt` | Org's team as away |
| `organizations.by_footballTeamId` | **Unique** — one org per team |

### 1.3 `competitions` row fields (sync metadata)

| Field | Purpose |
|-------|---------|
| `sourceCompetitionId` | VIB `meta.id` |
| `path` | e.g. `/competities/2025-2026/antwerpen/mannen/2a/` |
| `title`, `district`, `season` | From `meta` |
| `lastSyncedAt` | Client-side cache timestamp for TTL gating |
| `lastSyncError` | optional string — surface in admin/logs |

### 1.4 Migration

- [ ] Empty tables; wipe dev orgs if any before testing.
- [ ] Deploy schema before import.

**Acceptance:** `npx convex dev` pushes schema without errors.

---

## Phase 2 — API helpers & parsers (2 days)

### 2.1 Allowlist (`allowlist.ts`)

```ts
export const ALLOWED_COMPETITION_PATHS = [
  "/competities/2025-2026/antwerpen/mannen/2a/",
  "/competities/2025-2026/antwerpen/mannen/4a/",
] as const;
```

Used only to decide whether competition API calls are permitted. Does **not** block org registration.

### 2.2 Sync schedule / cache TTL (`syncSchedule.ts`)

Implements **VoetbalInBelgië API Handleiding §4** (user responsible for caching; over-fetching may cause blocking):

| Day (Europe/Brussels) | Time | Minimum interval between API calls |
|-------------------------|------|-------------------------------------|
| Monday – Friday | All day | **4 hours** |
| Saturday – Sunday | Before 15:00 | **1 hour** |
| Saturday – Sunday | From 15:00 | **15 minutes** |

```ts
export function getCompetitionSyncTtlMs(atMs: number): number;

export function shouldFetchCompetition(
  lastSyncedAt: number | undefined,
  atMs: number,
  options: { force?: boolean },
): boolean {
  if (options.force) return true;
  if (lastSyncedAt === undefined) return true;
  return atMs - lastSyncedAt >= getCompetitionSyncTtlMs(atMs);
}
```

**Cron design:** Convex cron ticks every **15 minutes** (shortest TTL). Each tick runs `syncLinkedCompetitions`, which **skips the HTTP call** when `shouldFetchCompetition` returns false. This respects the API schedule without over-fetching.

**Force fetch (`force: true`)** when:

- New org created (`createOrganization`).
- User changes linked team in Settings.
- Manual admin/dev re-sync command.

### 2.3 Fetch layer (`fetch.ts`)

| Function | Used by | Endpoint |
|----------|---------|----------|
| `fetchStamnummersHtml()` | Import only | Public HTML |
| `fetchClubPageHtml(path)` | Import only | Public HTML |
| `fetchCompetitionJson(path, apiKey)` | Sync only | `api.voetbalinbelgie.be` + `X-Api-Key` |

Sync code path must **never** import or call the HTML fetch functions.

### 2.4 HTML parsers — import only (`parseHtml.ts`)

Same as before: stamnummers, JSON-LD, multi-team tab parsing.

### 2.5 JSON parser (`parseCompetition.ts`)

- Returns `{ meta, relatedTeams, leaguetable, results, program }`.
- Strips `period1`–`period4`.
- `relatedTeams` used for **validation only** (team names expected in DB), not for upserting teams.

### 2.6 Helpers (`helpers.ts`)

```ts
buildVibMatchKey(sourceCompetitionId, date, home, away)

resolveFootballTeamId(ctx, sourceCompetitionId, vibTeamName): Id<"footballTeams">
  // throws or returns null → sync abort

assertAllCompetitionTeamsImported(ctx, dto): void
  // every leaguetable[].name must exist in footballTeams for sourceCompetitionId
```

### 2.7 Logo helper — import only (`logos.ts`)

Used exclusively by `importAllClubs`. Not called from sync.

**Acceptance:** Unit tests for parsers, TTL schedule (all 3 windows), and `assertAllCompetitionTeamsImported`.

---

## Phase 3 — Database write helpers (1½ days)

### 3.1 Internal mutations

| Mutation | Purpose |
|----------|---------|
| `upsertFootballTeam` | **Import only** |
| `upsertCompetition` | Sync — metadata from `meta` |
| `replaceCompetitionStandings` | Sync — full replace per competition |
| `upsertMatch` | Sync — by `vibMatchKey` |
| `patchCompetitionSyncStatus` | Update `lastSyncedAt` / `lastSyncError` |

No `setOrganizationFootballTeam` as separate mutation — team link set in `createOrganization` and `updateOrganizationFootballTeam` (Settings).

### 3.2 Queries

| Query | Auth | Purpose |
|-------|------|---------|
| `searchFootballTeams` | Public | Landing + onboarding search |
| `getFootballTeam` | Member | Settings display |
| `listTeamMatches` | Member | Calendar for org's team |
| `getCompetitionStandings` | Member | Standings (optional MVP) |
| `getCalendarAccessStatus` | Member | Returns `{ hasApiAccess, competitionPath, messageKey }` for calendar UI |

`getCalendarAccessStatus` drives the allowlist message on the **calendar page only**.

---

## Phase 4 — One-time club import (2 days)

Unchanged in scope: ~1608 club pages, logos to storage, multiple teams per club page.

### 4.1 Action: `football/actions.importAllClubs`

- Public HTML endpoints only.
- Upserts all `footballTeams` with `importSource: "club_page"`.
- Stores `sourceCompetitionId`, `competitionPath`, `vibTeamName` (= team name) for each team tab.
- **Does not** call competition API.

### 4.2 CLI

```json
"import:football-clubs": "npx convex run football/actions:importAllClubs"
```

Batch via scheduler (100 clubs per continuation) to avoid action timeout.

### 4.3 Pre-sync test (required before enabling sync)

```ts
// football/helpers.test.ts or integration test
test("all teams in allowlisted competitions exist after import", …)
```

For each allowlisted path, fetch competition JSON once (dev/manual), assert every `leaguetable[].name` has a matching `footballTeams` row with `(sourceCompetitionId, vibTeamName)`.

If test fails, fix import/name parsing before enabling sync in production.

### 4.4 Acceptance

- [ ] ≥1600 `footballTeams` rows.
- [ ] KSV Aartselaar + KSV Aartselaar B with correct paths and `vibTeamName`.
- [ ] Logos in `_storage` for imported teams.
- [ ] Pre-sync validation test passes for 2a and 4a.

---

## Phase 5 — Competition sync (2 days)

### 5.1 Core sync: `internalActions.syncCompetition`

Args: `{ competitionPath: string, force?: boolean }`

```
1. If !isCompetitionPathAllowed(path) → return { skipped: "not_allowlisted" } (no error)
2. Load competition row; if !shouldFetchCompetition(lastSyncedAt, now, { force }) → return { skipped: "ttl" }
3. json ← fetchCompetitionJson(path)                    ← ONLY API CALL
4. dto ← parseCompetitionJson(json)
5. assertAllCompetitionTeamsImported(ctx, dto)          ← abort if any name missing
6. upsertCompetition(dto.meta, path)
7. replaceCompetitionStandings(competitionId, dto.leaguetable)  ← resolve teamIds, no team writes
8. for each match in [...dto.results, ...dto.program]:
     homeTeamId ← resolveFootballTeamId(meta.id, match.home)
     awayTeamId ← resolveFootballTeamId(meta.id, match.away)
     upsertMatch(…)
9. patchCompetitionSyncStatus({ lastSyncedAt: now, lastSyncError: undefined })
```

On step 5 or 7 failure: set `lastSyncError`, do not update `lastSyncedAt`.

**Explicit non-actions during sync:**

- No `upsertFootballTeam`
- No logo downloads
- No public HTML fetches
- No reads from VIB club API URLs in `links.related[].href`

### 5.2 `syncLinkedCompetitions`

```
1. orgs ← all organizations with footballTeamId
2. teams ← distinct footballTeams referenced by those orgs
3. paths ← unique teams.competitionPath where defined
4. for each path:
     syncCompetition({ path, force: false })
```

No-op quickly when zero orgs.

### 5.3 Cron (`convex/crons.ts`)

```ts
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Tick every 15 min (shortest API TTL: Sat/Sun after 15:00).
// Actual HTTP calls gated inside syncCompetition via shouldFetchCompetition.
crons.interval(
  "check voetbal competition sync",
  { minutes: 15 },
  internal.football.internalActions.syncLinkedCompetitions,
  {},
);

export default crons;
```

**Effective maximum API call rate per linked competition:**

| When | Max calls |
|------|-----------|
| Weekday | ~6 per day (every 4h) |
| Weekend morning | ~15 per day (every 1h) |
| Weekend match afternoon | ~4 per hour (every 15 min) |

With current 2 allowlisted competitions and few linked orgs, this stays well within API expectations.

### 5.4 Acceptance

- [ ] Sync 2a updates standings + matches only; `footballTeams` row count unchanged.
- [ ] Second sync within TTL skips HTTP (log `skipped: "ttl"`).
- [ ] `force: true` bypasses TTL.
- [ ] Missing team name causes sync failure + `lastSyncError`.
- [ ] Non-allowlisted path returns `skipped: "not_allowlisted"` without error.

---

## Phase 6 — Organisation linking (1 day)

### 6.1 `createOrganization` (breaking change)

```ts
export const createOrganization = mutation({
  args: {
    footballTeamId: v.id("footballTeams"),
  },
  returns: v.id("organizations"),
  handler: async (ctx, args) => {
    const team = await ctx.db.get(args.footballTeamId);
    if (!team) throw new ConvexError("Team not found");

    // Verify team not already linked to another org
    // Organisation name = team.name (always)
    const organizationId = await ctx.db.insert("organizations", {
      name: team.name,
      slug: await generateUniqueSlug(ctx, team.name),
      footballTeamId: args.footballTeamId,
      …
    });

    // Schedule immediate competition sync (force: true) if allowlisted
    if (team.competitionPath && isCompetitionPathAllowed(team.competitionPath)) {
      await ctx.scheduler.runAfter(0, internal.football.internalActions.syncCompetition, {
        competitionPath: team.competitionPath,
        force: true,
      });
    }

    return organizationId;
  },
});
```

Remove `name` arg from mutation. Onboarding no longer asks for a club name.

### 6.2 `updateOrganizationFootballTeam` (Settings)

```ts
args: { footballTeamId: v.id("footballTeams") }
```

- Validate new team not linked to another org.
- Patch org `footballTeamId` and `name` (= new team.name).
- Schedule `syncCompetition({ path, force: true })` for new team's allowlisted path.

### 6.3 Invitation flow

Invitees joining an existing org inherit the org's `footballTeamId` automatically — no team selection.

### 6.4 Calendar access UI copy

New i18n keys for **calendar page only** when `!isCompetitionPathAllowed(team.competitionPath)`:

> We don't have access to your competition calendar yet. We'll add this in a future update.

Not shown on landing, onboarding, or settings.

**Acceptance:** Creating org with KSV Aartselaar triggers forced 2a sync; org name equals team name.

---

## Phase 7 — UI integration (2 days)

### 7.1 Landing hero search

- [ ] Debounced `searchFootballTeams` with dropdown (team name + competition title).
- [ ] Persist selected `footballTeamId` through sign-in → onboarding.
- [ ] **No** allowlist warning here.

### 7.2 Onboarding

- [ ] Remove free-text organisation name field.
- [ ] Show selected team; confirm or re-search.
- [ ] Call `createOrganization({ footballTeamId })` only.
- [ ] **No** allowlist warning here.

### 7.3 Settings

- [ ] Display linked team + competition.
- [ ] **Change team** control → `updateOrganizationFootballTeam`.

### 7.4 Calendar page (new or existing route)

- [ ] `listTeamMatches` when sync has data.
- [ ] `getCalendarAccessStatus` → show future-access message when not allowlisted or sync never succeeded.
- [ ] Empty state vs no-access state are distinct.

---

## Phase 8 — Template render integration (1 day)

- [ ] `MatchDto` from DB matches + teams (logos from `logoStorageId` on imported teams).
- [ ] `matchAddress` from home team's imported address.
- [ ] Opponent logos come from import-time storage (already linked to `footballTeams`).

---

## Phase 9 — Testing & observability (1 day)

| Test | Purpose |
|------|---------|
| TTL schedule | Mon 4h, Sat AM 1h, Sat PM 15m boundaries |
| `assertAllCompetitionTeamsImported` | Blocks sync when import incomplete |
| Sync does not mutate teams | Snapshot team count + fields before/after sync |
| Idempotent match upsert | Same `vibMatchKey` updates scores |
| `createOrganization` | Requires `footballTeamId`; sets name from team |
| Allowlist skip | Non-allowlisted path → no HTTP, no error |

Logging: `{ event, path, skipped?, force?, matchCount, durationMs, error? }`.

---

## Phase 10 — Documentation & handoff (½ day)

- [ ] Update [organisations.md](../Documentation/organisations.md) — mandatory `footballTeamId`, name = team name.
- [ ] Update [automations-and-templates.md](../Documentation/automations-and-templates.md).
- [ ] Update [voetbalinbelgie-api-research.md](../Documentation/voetbalinbelgie-api-research.md) — sync/TTL sections.
- [ ] Runbook: import command, TTL behavior, allowlist updates, pre-sync validation test.

---

## Implementation order

| Sprint | Deliverable |
|--------|-------------|
| **S1** | Schema, parsers, TTL helper, tests |
| **S2** | Import action + pre-sync validation test |
| **S3** | Sync (teams read-only) + cron + org mutations |
| **S4** | UI: search, onboarding, settings team change, calendar states |
| **S5** | Render bridge + docs |

**Total estimate:** ~10–12 dev days.

---

## Risk register

| Risk | Mitigation |
|------|------------|
| Team name mismatch import ↔ API | Pre-sync validation test; fix parsers before go-live |
| HTML layout changes | JSON-LD primary; fixture tests |
| API blocking from over-fetch | TTL gating + 15-min cron tick |
| Sync fails all teams missing | Clear `lastSyncError`; run import first |
| User picks team outside allowlist | Org created; calendar page explains; sync skipped |
| Opponent logo missing on render | Import all clubs first; logos static on team rows |

---

## Definition of done

- [ ] `pnpm import:football-clubs` populates all teams + logos.
- [ ] Pre-sync test passes for 2a + 4a.
- [ ] `createOrganization({ footballTeamId })` required; org name = team name.
- [ ] Sync updates standings + matches only; TTL respected; force on signup/settings change.
- [ ] Cron ticks every 15 min; HTTP calls follow API Handleiding schedule.
- [ ] Calendar page shows no-access message when allowlist blocks sync.
- [ ] Settings allows changing linked team.

---

## Out of scope

- Social OAuth posting pipeline
- Period rankings
- Org deletion → stop sync edge case
- Updating club/team records or logos after import
- Public HTML calls during sync
- Admin UI for allowlist (code constant for now)
