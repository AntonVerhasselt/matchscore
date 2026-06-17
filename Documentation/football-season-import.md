# Football data — season import runbook

Use this checklist at the **start of a new VoetbalInBelgië season** (typically August), when **expanding allowlisted competitions**, or after **import/parser changes**. It refreshes club/team records from public HTML so onboarding search and competition sync have correct data.

Related docs:

- [voetbalinbelgie-api-research.md](./voetbalinbelgie-api-research.md) — data model and API behaviour
- [voetbalinbelgie-api-samples.md](./voetbalinbelgie-api-samples.md) — live API samples
- [plans/voetbal-data-integration.md](../plans/voetbal-data-integration.md) — full integration plan

---

## What gets refreshed

| Pipeline | Source | Writes to | When |
|----------|--------|-----------|------|
| **Club import** (this runbook) | Public HTML (`voetbalinbelgie.be`) | `footballTeams`, logos in Convex storage | Start of season / manual |
| **Competition sync** (separate) | Authenticated JSON API | `competitions`, `competitionStandings`, `matches` | Cron + org signup (not covered here) |

Club import **does not** update match calendars. It **does** update team names, competition links, logos, and display-name disambiguation (e.g. `ASV Geel` vs `ASV Geel Dames`).

---

## Pre-flight checklist

Before importing on **dev** or **production**:

1. **Target the right Convex deployment**
   - Local dev: `npx convex dev` running, or `.env.local` points at your dev deployment.
   - Production: use `--prod` on all `npx convex` commands below.

2. **Set `VOETBALINBELGIE_API_KEY` on the Convex deployment** (required for post-import validation):

   ```bash
   npx convex env set VOETBALINBELGIE_API_KEY "your-key-here"
   # Production:
   npx convex env set --prod VOETBALINBELGIE_API_KEY "your-key-here"
   ```

3. **Update the competition allowlist for the new season** (if synced competitions changed):

   Edit `convex/lib/voetbalinbelgie/allowlist.ts` — replace `2025-2026` paths with the new season slug (e.g. `2026-2027`). Also update hardcoded paths in:
   - `scripts/diagnose-football-import.ts`
   - `scripts/diagnose-missing-teams.ts`
   - `scripts/test-voetbalinbelgie-api.ts`
   - Unit tests under `convex/lib/voetbalinbelgie/`

   Discover new paths and `meta.id` values:

   ```bash
   pnpm test:voetbalinbelgie-api
   ```

   Commit the allowlist + test updates, then deploy functions before importing.

4. **Deploy latest Convex code** to the target environment:

   ```bash
   npx convex dev --once          # dev
   npx convex deploy              # production (or via your CI)
   ```

---

## Recommended import flow (new season)

Use a **full** re-import (`skipCompleteClubs: false`). The default `pnpm import:football-clubs` skips clubs that already look complete — fine for incremental fixes, **not** for season rollover.

### Step 1 — Unit tests

```bash
pnpm test
```

Confirms parsers, disambiguation logic, and upsert behaviour.

### Step 2 — Full club import

```bash
pnpm import:football-clubs:full
```

Production:

```bash
npx convex run --prod football/actions:importAllClubs '{"skipCompleteClubs":false}'
# Then run steps 3–4 manually with --prod (see command reference)
```

This script:

1. Starts batched import (~50 clubs per batch, ~1600+ clubs total).
2. Polls team count until stable (expect **~2 600+** `footballTeams` rows — multiple teams per club).
3. Runs display-name repair (`pnpm repair:football-team-names`).
4. Runs allowlist pre-sync validation (`pnpm test:football-pre-sync`).
5. On validation failure, runs competition-team repair and re-validates.

Import duration: roughly **30–60 minutes** depending on deployment load. Watch Convex dashboard logs for `football_import_batch` events.

### Step 3 — Confirm team count

```bash
npx convex run football/internalQueries:countFootballTeams '{}'
```

Expect a stable count ≥ **1600** clubs worth of rows (typically **~2 600+** team rows). Run twice; the number should not still be climbing.

### Step 4 — Pre-sync validation (allowlisted competitions)

```bash
pnpm test:football-pre-sync
```

Must exit **0** with `ok: true` for every allowlisted path. This proves every team name referenced in those competition APIs exists in `footballTeams` (matched by `sourceCompetitionId` + `vibTeamName`).

If it fails:

```bash
pnpm repair:football-teams
pnpm test:football-pre-sync
```

### Step 5 — Display names (duplicate club teams)

Idempotent — safe to run again:

```bash
pnpm repair:football-team-names
```

Ensures clubs with men’s + women’s teams (same VoetbalInBelgië name) get unique search names, e.g. `ASV Geel` and `ASV Geel Dames`.

### Step 6 — App smoke tests

Manual checks on the target environment:

| Check | How |
|-------|-----|
| Hero search | Search `Aartselaar`, `Geel` — logo + distinct names in dropdown |
| Duplicate names | Search `ASV Geel` — should show **two** distinct rows (men / dames) |
| Onboarding | Pick a club → sign in → confirm pre-selected team → create org |
| Existing orgs | Open `/app` for an existing club — still linked to correct team |

---

## Incremental import (not season rollover)

Use when fixing gaps without re-fetching every club page:

```bash
pnpm import:football-clubs
```

Uses `skipCompleteClubs: true` — only clubs missing complete competition metadata are re-fetched.

---

## Command reference

| Command | Purpose |
|---------|---------|
| `pnpm test` | Unit tests (parsers, disambiguation, upserts) |
| `pnpm import:football-clubs:full` | **Season rollover** — re-import all clubs + repair + validate |
| `pnpm import:football-clubs` | Incremental import (skip complete clubs) |
| `pnpm repair:football-team-names` | Fix duplicate display names within a club |
| `pnpm repair:football-teams` | Re-fetch club pages for teams missing from allowlisted competitions |
| `pnpm test:football-pre-sync` | Validate allowlisted competition API ↔ DB team coverage |
| `pnpm test:voetbalinbelgie-api` | Refresh API sample doc; verify competition paths and `meta.id` |
| `npx convex run football/internalQueries:countFootballTeams '{}'` | Total `footballTeams` rows |
| `npx convex run football/queries:searchFootballTeams '{"query":"Geel"}'` | Spot-check search results |
| `tsx scripts/diagnose-football-import.ts` | Compare HTML parse vs API for allowlisted competitions |

Add `--prod` to `npx convex run` / `npx convex env set` when operating on production.

---

## Troubleshooting

### Pre-sync reports missing teams

1. Run `pnpm repair:football-teams`.
2. If still failing, diagnose a specific club:

   ```bash
   tsx scripts/diagnose-football-import.ts
   ```

3. Check Convex logs for `football_import_repair_error` / `football_import_batch` errors.

Common cause: club page panels without tab links (parser handles via `id="comp-{id}"` panels). Re-fetch that club:

   ```bash
   npx convex run football/internalActions:repairMissingCompetitionTeams \
     '{"slugPaths":["/clubs/g/geel-asv/"]}'
   ```

### Import count stuck below ~1600

- Confirm import batches finished (`football_import_batch` with `nextStartIndex: null` in logs).
- Re-run full import: `pnpm import:football-clubs:full`.

### Duplicate search results for the same club

Run `pnpm repair:football-team-names`. Men’s team keeps the base name; women’s gets `Dames`; reserve men’s gets `B`.

### `VOETBALINBELGIE_API_KEY is not configured`

Set the key on the **Convex deployment** (not only in `.env.local`):

```bash
npx convex env set VOETBALINBELGIE_API_KEY "…"
```

### Stale teams from a previous season

Club import upserts by `(stamnummer, sourceCompetitionId)`. When VoetbalInBelgië assigns **new** competition panel IDs for a new season, new rows are created alongside older ones. Existing organisations keep their linked `footballTeamId` — they are unaffected.

After a full import:

- Search may show outdated rows until stale cleanup is implemented.
- Monitor row count; if it grows well above ~2 800, review old-season rows in the Convex dashboard (`footballTeams` filtered by previous `competitionPath` season slug).

For **dev only**, you can wipe users/orgs/auth and re-test signup without re-importing clubs:

```bash
pnpm db:clear-dev
pnpm seed:football-team   # only if you skipped full import and need Aartselaar
```

`db:clear-dev` preserves `footballTeams` (and logo storage). Do **not** run it on production.

---

## “Ready for the season” checklist

Copy and tick before opening registration / sync to users:

- [ ] Allowlist updated for new season paths (`allowlist.ts` + tests)
- [ ] Convex functions deployed to target environment
- [ ] `VOETBALINBELGIE_API_KEY` set on that deployment
- [ ] `pnpm test` passes
- [ ] `pnpm import:football-clubs:full` completed without errors
- [ ] `countFootballTeams` stable and ≥ expected minimum
- [ ] `pnpm test:football-pre-sync` passes
- [ ] `pnpm repair:football-team-names` run (updated > 0 or updated = 0 after prior run)
- [ ] Hero search + onboarding smoke-tested
- [ ] Production: `--prod` used consistently for import and validation

When all boxes are checked, club/team static data is ready. Turn on or verify **competition sync** separately for live calendars and standings.
