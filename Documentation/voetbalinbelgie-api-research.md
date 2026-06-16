# VoetbalInBelgië data integration — research & recommendations

> **Branch:** `voetbal-data`  
> **Live samples:** [voetbalinbelgie-api-samples.md](./voetbalinbelgie-api-samples.md) (generated via `pnpm test:voetbalinbelgie-api`)  
> **Implementation plan:** [../plans/voetbal-data-integration.md](../plans/voetbal-data-integration.md)

---

## 1. Product context (Matchscore)

Matchscore automates social media for **Belgian amateur football clubs**:

1. A club searches/selects itself on the landing page.
2. Matchscore imports the **first-team calendar** from VoetbalInBelgië (Belgian federation data surfaced via voetbalinbelgie.be).
3. The club designs **templates** for match announcements (~2 days before kick-off) and match results (when published).
4. Automations render PNGs with dynamic bindings (`homeClubName`, `awayClubName`, logos, score, date/time, address) and post to Facebook/Instagram.

Today the app has organisations, automations, and templates — but **no real match data**. Template render tests use `MockMatchDto` in `lib/template-scene/mock-match.ts`.

Football data must therefore support:

- Club/team search during onboarding (1600+ clubs).
- Linking one organisation → one team (first team, second team, …).
- Competition calendar + results for automations.
- Opponent names and logos in rendered posts.
- Ranking (optional in MVP UI, required in API response).

---

## 2. API shape and documentation

### 2.1 Public HTML endpoints (no auth)

| Endpoint | Returns | Role |
|----------|---------|------|
| `GET https://www.voetbalinbelgie.be/stamnummers/` | HTML table of all clubs | Bootstrap list: stamnummer, display name, `/clubs/{letter}/{slug}/` path |
| `GET https://www.voetbalinbelgie.be/clubs/{letter}/{slug}/` | HTML club page | Contact info, logo, JSON-LD, active teams + competition links |

**Stamnummers parsing**

Each club is a `<dt>Stamnummer {n}</dt><dd>…<a href="/clubs/…">name</a></dd>` pair. Live probe parsed **1608** clubs.

Fields available:

| Field | Source | Example |
|-------|--------|---------|
| `stamnummer` | `<dt>` text | `7302` |
| `displayName` | link text in `<dd>` | `Aartselaar KSV` |
| `slugPath` | href | `/clubs/a/aartselaar-ksv/` |
| `slug` | last path segment | `aartselaar-ksv` |

**Club detail parsing**

Reliable structured data comes from **JSON-LD** (`<script type="application/ld+json">`, `@type: SportsClub`):

| Field | JSON-LD path | Notes |
|-------|--------------|-------|
| `legalName` / base name | `name` | e.g. `KSV Aartselaar` |
| `stamnummer` | `branchCode` | Same as stamnummers index |
| `website` | `url` | External club site |
| `telephone` | `telephone` | e.g. `03/887.94.68` |
| `logoUrl` | `logo` | Absolute PNG URL on voetbalinbelgie.be |
| Address | `address.streetAddress`, `postalCode`, `addressLocality`, `addressRegion`, `addressCountry` | Shared by all teams from same club page |

Additional HTML fields worth storing:

| Field | Source |
|-------|--------|
| `province` | `<body class="… antwerpen …">` or breadcrumb |
| `clubPageUrl` | canonical link |
| `nameMeaning` | “Betekenis clubnaam” link text |
| Nearby clubs | optional, low priority |

**Multiple teams per club page**

Many clubs field more than one team (first team + second team). These appear as Bootstrap tabs `#comp-{sourceCompetitionId}`:

| Tab label | Team name (in standings) | Competition path | sourceCompetitionId |
|-----------|--------------------------|------------------|---------------------|
| Mannen | KSV Aartselaar | `/competities/2025-2026/antwerpen/mannen/2a/` | 389 |
| Mannen B | KSV Aartselaar B | `/competities/2025-2026/antwerpen/mannen/4a/` | 394 |

**Parsing algorithm (validated on Aartselaar + Berchem):**

1. Read JSON-LD `SportsClub` for shared club metadata + logo.
2. Find all `href="#comp-{id}"` tabs for current season panels.
3. For each panel, extract `competitionPath` (first `/competities/2025-2026…` link).
4. Find the standings row `<td class="club">` whose `<img src>` contains the club **slug**; read team name from the adjacent link text (or img `alt`).
5. Emit **one database team record per tab** using the **team name** as `name` (not the parent club name).

Clubs with a single team produce one tab. Clubs without current-season tabs still get one record from JSON-LD (no `competitionPath` until discovered elsewhere).

**Logo storage**

- Download `logo` from JSON-LD (PNG on voetbalinbelgie.be CDN).
- Store in Convex `_storage`; persist `logoStorageId` on each team row.
- A and B teams from the same page share the same downloaded logo blob (dedupe by source URL hash during import).

**Match IDs on website (not in JSON API)**

Club HTML H2H links use `/wedstrijd/{numericId}/…` (e.g. `724371`). The authenticated competition JSON **does not expose this id**. We must generate our own stable match key (see §3).

---

### 2.2 Authenticated JSON endpoint

| Endpoint | Auth | Returns |
|----------|------|---------|
| `GET https://api.voetbalinbelgie.be/competities/{path}/` | Header `X-Api-Key: {VOETBALINBELGIE_API_KEY}` | JSON |

**Response top-level shape**

```json
{
  "competition": {
    "meta": { … },
    "links": { "self": "…", "related": [ … ] },
    "leaguetable": [ … ],
    "period1": [ … ],
    "period2": [ … ],
    "period3": [ … ],
    "period4": [ … ],
    "results": [ … ],
    "program": [ … ]
  }
}
```

**`competition.meta`**

| Field | Type | Store? | Notes |
|-------|------|--------|-------|
| `id` | number | **Yes** | Stable competition id (389, 394, …) — primary external key |
| `title` | string | Yes | e.g. `2e provinciale A, Antwerpen, Mannen` |
| `district` | string | Yes | e.g. `Antwerpen` |
| `season` | string | Yes | e.g. `2025/2026` |
| `copyright` | string | Optional | Terms metadata |
| `termsAndConditions` | string | No | Display/legal only |

**`competition.links.related`** — participating teams (16 per league)

| Field | Type | Store? |
|-------|------|--------|
| `name` | string | Yes — matches `home`/`away` in calendar |
| `shirt` | string | Optional asset ref |
| `logo` | string | Yes — webp filename; build CDN URL or import to storage |
| `href` | string | Yes — API club path slug |

**`competition.leaguetable`** — general ranking (store)

| Field | Type |
|-------|------|
| `position`, `name`, `shirt`, `logo` | |
| `matches`, `wins`, `ties`, `losses`, `points` | |
| `goalsFor`, `goalsAgainst`, `pointsPunished` | |

**`competition.period1`–`period4`** — period standings

Do **not** store (per product requirement).

**`competition.results`** — played matches (store)

| Field | Type | Notes |
|-------|------|-------|
| `status` | string | `Gespeeld`, `Forfait één ploeg`, … |
| `date` | ISO 8601 string | Kick-off timestamp with timezone |
| `home`, `away` | string | Team names — join key to teams |
| `homeGoals`, `awayGoals` | number | Present when result known |
| `result` | string | Display string e.g. `2 - 2`, `5 - 0(Forfait)` |

Live probe (2a, April 2026): all 240 rows had status `Gespeeld`; `program` was empty (season complete). During an active season, **`program` holds upcoming fixtures** with the same row shape; **`results` holds finished matches**.

**API key scope (current)**

Only these paths return 200:

- `/competities/2025-2026/antwerpen/mannen/2a/` → meta.id **389**
- `/competities/2025-2026/antwerpen/mannen/4a/` → meta.id **394**

All other competition paths must be skipped via a configurable allowlist helper until the API subscription expands.

---

### 2.3 Identity & linking strategy

There is **no single universal id** across HTML and JSON for a *team*, but these stable keys exist:

| Entity | Best external key | Notes |
|--------|-------------------|-------|
| Parent club | `stamnummer` (`branchCode`) | Unique per registered club |
| Team in a competition | `(sourceCompetitionId, vibTeamName)` | e.g. `(389, "KSV Aartselaar")` |
| Competition | `sourceCompetitionId` (`meta.id`) | Unique; path is also stable per season |
| Match | **No VIB id in JSON** | Derive `vibMatchKey = "{sourceCompetitionId}:{date}:{home}:{away}"` |

**Recommendation**

- Store `sourceCompetitionId` on each **team** row (from club page tab / later from sync).
- Store `vibTeamName` exactly as returned in competition JSON (`name` in leaguetable / `home`/`away` in matches).
- On competition sync, upsert teams from `links.related` + `leaguetable` keyed by `(sourceCompetitionId, vibTeamName)`.
- Link matches to teams via `(sourceCompetitionId, homeName)` lookups, not stamnummer (opponents may not be in stamnummers import yet).
- Keep `slugPath` + `stamnummer` on teams discovered via club import for onboarding search.

**Organisation ↔ team**

- Add `footballTeamId: v.optional(v.id("footballTeams"))` on `organizations`.
- **One org → one team** (product model).
- **One team → one org** recommended: add a unique index on `organizations.by_footballTeamId` to prevent duplicate automations for the same team. Parent club with two teams = two team rows = two possible orgs (first team vs reserve team).

When org links to a team, trigger competition import/sync for that team's `sourceCompetitionId` (if allowlisted).

---

## 3. Convex database schema (recommended)

Design goals: store all useful API fields, avoid duplication, keep table count small, support org-scoped sync.

### 3.1 Tables

#### `footballTeams`

One row per **team** (not per stamnummer parent). Includes opponents once a competition is synced.

| Field | Type | Source |
|-------|------|--------|
| `name` | string | Team name in competition / parsed tab |
| `vibTeamName` | string | Exact name used in match JSON (may equal `name`) |
| `stamnummer` | optional string | From JSON-LD; absent for some opponents until linked |
| `slugPath` | optional string | `/clubs/a/aartselaar-ksv/` when known |
| `slug` | optional string | `aartselaar-ksv` |
| `parentStamnummer` | optional string | Same as stamnummer for teams from same club page |
| `sourceCompetitionId` | optional number | VIB `meta.id` |
| `competitionPath` | optional string | `/competities/2025-2026/…/` |
| `tabLabel` | optional string | e.g. `Mannen`, `Mannen B` |
| `website`, `telephone` | optional string | JSON-LD |
| `address` | optional object | `{ street, postalCode, city, region, country }` |
| `province` | optional string | |
| `logoStorageId` | optional `Id<"_storage">` | Downloaded once |
| `logoSourceUrl` | optional string | Dedupe downloads |
| `vibLogoFile` | optional string | e.g. `aartselaar-ksv.webp` from API |
| `importSource` | union | `stamnummers`, `club_page`, `competition_sync` |
| `importedAt` | number | |

**Indexes**

- `by_stamnummer_and_name` → `[stamnummer, name]` — club import upserts
- `by_slugPath_and_name` → `[slugPath, name]`
- `by_competition_and_vibTeamName` → `[sourceCompetitionId, vibTeamName]` — match linking
- `by_name` → `[name]` — onboarding search (consider normalized search field later)

#### `competitions`

One row per VIB competition (dedupe the ~16 teams sharing the same path).

| Field | Type |
|-------|------|
| `sourceCompetitionId` | number (unique) |
| `path` | string (unique) — e.g. `/competities/2025-2026/antwerpen/mannen/2a/` |
| `title`, `district`, `season` | string |
| `lastSyncedAt` | optional number |
| `syncEnabled` | boolean — true when ≥1 linked org's team participates |

**Indexes**

- `by_sourceCompetitionId`
- `by_path`

#### `competitionStandings`

General ranking snapshot (overwrite on sync).

| Field | Type |
|-------|------|
| `competitionId` | `Id<"competitions">` |
| `teamId` | `Id<"footballTeams">` |
| `position`, `matches`, `wins`, `ties`, `losses`, `points` | number |
| `goalsFor`, `goalsAgainst` | number |
| `pointsPunished` | string |
| `shirt`, `vibLogoFile` | optional string |

**Index:** `by_competitionId_and_teamId` (unique)

#### `matches`

| Field | Type |
|-------|------|
| `competitionId` | `Id<"competitions">` |
| `vibMatchKey` | string — `{sourceCompetitionId}:{date}:{home}:{away}` |
| `homeTeamId`, `awayTeamId` | `Id<"footballTeams">` |
| `kickoffAt` | number — `Date.parse(date)` |
| `status` | string |
| `homeGoals`, `awayGoals` | optional number |
| `resultText` | optional string |
| `updatedAt` | number |

**Indexes**

- `by_vibMatchKey` (unique)
- `by_competitionId_and_kickoffAt`
- `by_homeTeamId_and_kickoffAt`
- `by_awayTeamId_and_kickoffAt`

**Venue / address:** not in competition JSON. For template `matchAddress`, resolve from **home team** address at render time (or denormalize `venueAddress` on match when home team has address).

#### `organizations` (extend existing)

| New field | Type |
|-----------|------|
| `footballTeamId` | **required** `Id<"footballTeams">` on insert |

- Organisation **name** is always the linked team's `name` (no separate free-text name at onboarding).
- **Index:** `by_footballTeamId` (unique — one org per team).
- Team may be changed later in Settings (`updateOrganizationFootballTeam`).

### 3.2 Why a separate `competitions` table?

Yes — recommended:

- 16 teams share one competition path; storing competition metadata on every team duplicates title/season/district.
- Sync jobs operate per **unique competition path** (user requirement).
- `lastSyncedAt` and allowlist gating live on one row.

### 3.3 What we deliberately omit

| Data | Reason |
|------|--------|
| Period rankings | Product decision |
| Raw HTML / full JSON blobs | Store parsed fields only |
| VIB `/wedstrijd/{id}` | Not in JSON API |
| Nearby clubs, FAQ, archive seasons | Not needed for automations |

---

## 4. Helper functions (API layer)

Suggested module: `convex/voetbalinbelgie/` (pure fetch+parse) + `convex/lib/voetbalinbelgie/` for parsers testable without Convex.

### 4.1 Allowlist

```ts
// convex/voetbalinbelgie/allowlist.ts
const ALLOWED_COMPETITION_PATHS = new Set([
  "/competities/2025-2026/antwerpen/mannen/2a/",
  "/competities/2025-2026/antwerpen/mannen/4a/",
]);

export function isCompetitionPathAllowed(path: string): boolean {
  return ALLOWED_COMPETITION_PATHS.has(normalizePath(path));
}
```

Adjust the set when the API key gains access to more leagues.

### 4.2 Public HTML helpers

| Helper | Input | Output |
|--------|-------|--------|
| `fetchStamnummersIndex()` | — | `{ stamnummer, displayName, slugPath }[]` |
| `fetchClubPage(slugPath)` | `/clubs/a/foo/` | `{ sportsClub, teams[], html? }` |
| `parseStamnummersHtml(html)` | HTML | index rows |
| `parseClubTeamsFromHtml(html, slug)` | HTML + slug | team rows with competitionPath |
| `parseSportsClubJsonLd(html)` | HTML | contact + logo |

### 4.3 Authenticated JSON helper

| Helper | Input | Output |
|--------|-------|--------|
| `fetchCompetition(path, apiKey)` | path | parsed DTO |
| `parseCompetitionJson(json)` | raw JSON | `{ meta, relatedTeams, leaguetable, results, program }` — **strips period1–4** |

Return DTO types in `convex/voetbalinbelgie/types.ts` shared with import/sync actions.

### 4.4 Logo helper (import only)

`downloadLogoToStorage(ctx, sourceUrl)` — idempotent on `logoSourceUrl`; used **only** during the one-time club import. Competition sync does **not** download or update logos.

### 4.5 Sync schedule helper (`syncSchedule.ts`)

Implements VoetbalInBelgië API Handleiding §4 (November 2025):

| Day (Europe/Brussels) | Time | Minimum interval between competition API calls |
|-------------------------|------|-----------------------------------------------|
| Monday – Friday | All day | 4 hours |
| Saturday – Sunday | Before 15:00 | 1 hour |
| Saturday – Sunday | From 15:00 | 15 minutes |

The API states the client is responsible for caching; excessive requests may lead to blocking. Matchscore stores `competitions.lastSyncedAt` and skips HTTP when inside the TTL window. Cron ticks every **15 minutes** (shortest TTL); actual fetches are gated by `shouldFetchCompetition()`. User-initiated sync (`createOrganization`, Settings team change) passes `force: true` to bypass TTL.

---

## 5. Data sync & updating

### 5.1 Phase A — One-time club/team import (static)

**Command:** `pnpm import:football-clubs` (Convex action or Node script calling internal mutations)

Flow:

1. `fetchStamnummersIndex()` → ~1608 paths.
2. For each path (batched, rate-limited):
   - `fetchClubPage` → parse JSON-LD + team tabs.
   - Download logo once per page (shared across teams).
   - Upsert `footballTeams` rows keyed by `(stamnummer, name)`.
3. Do **not** call competition API for every team (would be 1608+ calls); only store `competitionPath` + `sourceCompetitionId` from HTML tabs.
4. Mark `importSource: "club_page"`.

This data is treated as static for the season (address, phone, logo). Re-run manually if VIB publishes corrections.

### 5.2 Phase B — Competition sync (dynamic)

**Endpoint rule:** Sync calls **only** `GET https://api.voetbalinbelgie.be/competities/{path}/` with `X-Api-Key`. Never public HTML; never club sub-endpoints from `links.related[].href`.

**Write rule:** Sync updates **`competitions`**, **`competitionStandings`**, and **`matches`** only. It does **not** create or update `footballTeams` or logos — those come from the one-time import and stay static.

**Scope rule:** Only sync competitions where **≥1 org's `footballTeamId` points at a team in that competition**. If the path is not on the allowlist, skip silently (org registration still succeeds; calendar page shows a future-access message).

**Unique paths:** Distinct `competitionPath` from linked teams → dedupe → sync each.

**Pre-sync validation:** Every name in `leaguetable` must already exist as `footballTeams` row with matching `(sourceCompetitionId, vibTeamName)`. Automated test required after import. Sync aborts if any team is missing.

**Per competition sync:**

1. Skip if not allowlisted or inside TTL (unless `force: true`).
2. `fetchCompetition(path)` — **only HTTP call**.
3. `assertAllCompetitionTeamsImported(dto)`.
4. Upsert `competitions` row from `meta`.
5. Replace `competitionStandings` (resolve team ids; no team writes).
6. Upsert `matches` from `[...results, ...program]` using `vibMatchKey` (resolve home/away team ids).
7. Update `competitions.lastSyncedAt`.

### 5.3 Ongoing updates

**Cron** (`convex/crons.ts`) — tick every **15 minutes**:

```ts
crons.interval(
  "check voetbal competition sync",
  { minutes: 15 },
  internal.football.internalActions.syncLinkedCompetitions,
  {},
);
```

Inside `syncLinkedCompetitions`, each competition path checks `shouldFetchCompetition(lastSyncedAt, now, { force: false })` before calling the API, following the TTL table in §4.5.

When a **new org is created** (`createOrganization({ footballTeamId })`):

1. Org name = team name.
2. Schedule `syncCompetition({ path, force: true })` if allowlisted (bypasses TTL).

When a **user changes team in Settings**:

1. Patch `footballTeamId` and org `name`.
2. Schedule forced sync for new team's allowlisted path.

Future posting job (not in this scope):

- `match_announcement`: matches where `kickoffAt` ≈ now + 2 days, status not finished.
- `match_result`: matches where `homeGoals`/`awayGoals` updated since last post.

### 5.4 Edge cases (deferred)

- Org deleted / unlinked from last team in a competition → stop syncing that competition (user asked to disregard for now).
- Team changes competition mid-season → update `sourceCompetitionId` on team row + resync.
- API key expansion → update allowlist only.

---

## 6. Efficient orchestration summary

| Operation | Calls | Notes |
|-----------|-------|-------|
| Full club import | 1 + 1608 | Public HTML only; one-time |
| Link org to team | 0–1 competition | Forced sync if allowlisted; bypasses TTL |
| Periodic sync | #unique linked competitions × TTL rate | Cron every 15 min; HTTP only when TTL expired |
| Dedup | competition path | 16 teams → 1 API call; no team row writes |

---

## 7. Mapping to template bindings

Replace `MockMatchDto` with data from `matches` + joined teams:

| Binding | Source |
|---------|--------|
| `homeClubName` | `footballTeams.name` (home) |
| `awayClubName` | away team |
| `homeClubLogo` | signed URL from home `logoStorageId` |
| `awayClubLogo` | away team logo |
| `matchDateTime` | `matches.kickoffAt` |
| `score` | `homeGoals` – `awayGoals` |
| `matchAddress` | home team `address` formatted |

---

## 8. Decisions log (confirmed)

| Question | Decision |
|----------|----------|
| Separate competitions table? | **Yes** |
| Generated ids vs VIB ids? | VIB `meta.id` for competitions; `vibMatchKey` for matches; Convex `_id` for joins |
| Sync writes teams? | **No** — import only; sync updates standings + matches |
| Logos during sync? | **Ignored** — import once to Convex storage |
| Org name | Always selected **team name** |
| `footballTeamId` | **Required** on `createOrganization` |
| Allowlist gap | Register silently; message on **calendar page only** |
| Change team | **Allowed in Settings** |
| First sync TTL | **Bypass** (`force: true`) |
| API cache TTL | API Handleiding §4; `Europe/Brussels`; cron tick 15 min |
| Multiple orgs per team? | **Disallow** (unique index) |
| B teams? | Separate `footballTeams` rows |

---

## 9. Related files to create (implementation)

See [plans/voetbal-data-integration.md](../plans/voetbal-data-integration.md) for step-by-step delivery plan.
