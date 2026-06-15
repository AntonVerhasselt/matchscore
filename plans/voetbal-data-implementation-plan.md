# Voetbal data integration — implementation plan

**Status:** Research complete — ready for implementation  
**Branch:** `voetbal-data-research`  
**Prerequisite docs:** [voetbal-data-research.md](../Documentation/research/voetbal-data-research.md), [voetbalinbelgie-api-reference.md](../Documentation/research/voetbalinbelgie-api-reference.md)

This plan does **not** implement code yet. It defines phases, files, functions, and acceptance criteria.

---

## Goals

1. Import Belgian amateur football data from Voetbal in België API.
2. Support club search/onboarding via stamnummers.
3. On registration, import calendar + standings for the club's **Mannen** competitions.
4. Keep data fresh with TTL-aware competition polling.
5. Trigger `match_announcement` ~2 days before kickoff and `match_result` when scores publish.
6. Support multiple club customers without duplicate matches or redundant API calls.

---

## Non-goals (this initiative)

- Social OAuth / Meta posting (separate initiative).
- Youth/reserve teams.
- Historical season archive UX.
- Netherlands/France APIs (Hollandse Velden / Ligues de Foot).

---

## Phase 0 — Prerequisites & API verification

### 0.1 Capture live API responses

**Owner action (local machine with Convex linked):**

```bash
pnpm probe:voetbal-api
# Commit updated Documentation/research/voetbalinbelgie-api-reference.md
```

**Validate:**

- [ ] Stamnummers JSON parsed into typed structure
- [ ] Competition rows include match identifiers (id or URL)
- [ ] Club JSON lists current-season Mannen competitions
- [ ] Match JSON includes venue address fields used by `matchAddress` binding

### 0.2 Convex env

- [ ] `VOETBALINBELGIE_API_KEY` on dev + prod deployments
- [ ] Document in README (Convex env, not `.env.local`)

### 0.3 Dependencies

No new npm packages required for MVP (use `fetch` in `"use node"` actions).

---

## Phase 1 — Schema & football module skeleton

### 1.1 Add tables to `convex/schema.ts`

Implement tables from research doc:

| Table | Priority |
| --- | --- |
| `footballClubs` | P0 |
| `footballCompetitions` | P0 |
| `footballMatches` | P0 |
| `organizationFootballProfile` | P0 |
| `footballAutomationRuns` | P0 |
| `footballSyncJobs` | P1 (can use cron logs initially) |
| `footballStandings` | P2 (defer) |

### 1.2 Create feature folder `convex/football/`

```
convex/football/
├── validators.ts          # Shared v.* types, status unions
├── constants.ts           # TTL ms, preview offset, team labels
├── helpers.ts             # Pure: hash, parse dates, name normalize
├── apiClient.ts           # "use node" — fetch + fallback URL logic
├── queries.ts             # Club search, org calendar
├── mutations.ts           # Link org to club (onboarding)
├── internalActions.ts     # sync stamnummers, sync competition, sync club
├── internalMutations.ts   # Upsert matches, schedule automations
├── crons.ts               # stamnummers weekly, competition poll, reconciliation
├── automations.ts         # runPreview, runResult (internal)
└── probeApi.ts            # Already added for API probing
```

Follow [convex-structure.md](../Documentation/convex-structure.md): ≤150 lines per file, split as needed.

### 1.3 Validators & types

Define explicit validators for:

- `matchStatus`: `scheduled` | `finished` | `postponed` | `cancelled` | `unknown`
- `syncTier`: `active` | `dormant`
- `automationRunStatus`: `scheduled` | `running` | `posted` | `skipped` | `failed`

Map Dutch API statuses in `helpers.ts` (single function).

### 1.4 Acceptance criteria

- [ ] `npx convex dev` codegen succeeds
- [ ] Empty tables queryable
- [ ] ESLint passes on new files

---

## Phase 2 — API client & parsers

### 2.1 `apiClient.ts`

```typescript
// Pseudocode
fetchVoetbalApi(path: string): Promise<{ json: unknown; requestUrl: string }>
```

- Read `process.env.VOETBALINBELGIE_API_KEY`
- Try `https://api.voetbalinbelgie.be${path}`
- Fallback to `index.php?sFormat=API&sUrl=...` on HTML response
- Throw typed errors for 401/429

### 2.2 Parsers (`helpers.ts` or `parsers/`)

| Parser | Input | Output |
| --- | --- | --- |
| `parseStamnummers` | JSON | `FootballClubUpsert[]` |
| `parseCompetition` | JSON | meta, standings, matches[], related clubs[] |
| `parseClub` | JSON | club profile + competition paths |
| `parseMatch` | JSON | venue, teams, score, competition path |

### 2.3 Match identity extraction

Implement `extractExternalMatchId(apiPathOrUrl): string | null` — regex on `/wedstrijd/(\d+)/`.

### 2.4 Acceptance criteria

- [ ] Unit tests for parsers with fixtures from `voetbalinbelgie-api-reference.md`
- [ ] Date parsing handles `Europe/Brussels` (`2025-09-20 19:30:00`)
- [ ] Hash function stable across key order

---

## Phase 3 — Stamnummers bootstrap

### 3.1 `internal.football.sync.importStamnummers`

1. `GET /stamnummers/`
2. Upsert `footballClubs` by `stamnummer`
3. Update `searchText` (normalize accents, lowercase)

### 3.2 Cron

`crons.ts`:

```typescript
crons.weekly("import stamnummers", { dayOfWeek: "monday", hourUTC: 3 }, internal.football.sync.importStamnummers);
```

Also expose `internal.football.sync.importStamnummers` for manual backfill.

### 3.3 Public query: club search

`queries.searchFootballClubs({ query, limit })` — prefix search on `searchText`.

### 3.4 Acceptance criteria

- [ ] ≥1000 clubs imported in dev
- [ ] Search returns KSV Aartselaar for "aartselaar"
- [ ] No competition/match rows created

---

## Phase 4 — Organization ↔ club linking (onboarding)

### 4.1 Schema link

Extend onboarding:

- `organizations` optional: `footballClubId` **or** separate `organizationFootballProfile` (preferred).

### 4.2 `mutations.linkOrganizationToFootballClub`

Args: `stamnummer` or `footballClubId`.

1. Auth + membership check.
2. Insert `organizationFootballProfile`.
3. Schedule `internal.football.sync.activateOrganizationFootballData`.

### 4.3 `internal.football.sync.activateOrganizationFootballData`

1. Fetch club endpoint.
2. Filter competitions to current season + Mannen team.
3. For each competition path:
   - Upsert `footballCompetitions` with `syncTier=active`
   - Call `syncCompetitionFull`
4. Schedule preview jobs for imported fixtures.

### 4.4 UI (follow-up PR)

- Wire `HeroClubSearch` → real search query.
- Onboarding: pick club from search results.

### 4.5 Acceptance criteria

- [ ] Registering KSV Aartselaar imports 2a (and other Mannen) competition matches
- [ ] `footballMatches` count ≈ full season for that competition
- [ ] Second org in same competition does not duplicate matches

---

## Phase 5 — Competition sync engine

### 5.1 `internal.football.sync.syncCompetition`

Args: `competitionId` or `apiPath`.

1. Fetch competition JSON.
2. Compute hash of program+results.
3. If unchanged → update `nextPollAfter` only.
4. Else:
   - Upsert related clubs from `links.related`
   - Upsert matches (dedupe keys)
   - Resolve `homeClubId`/`awayClubId`
   - Detect changes: kickoff moved, new result

### 5.2 `internal.football.sync.syncActiveCompetitions`

1. Query competitions where `syncTier=active` AND `nextPollAfter <= now`
2. For each, call `syncCompetition`
3. Respect concurrency limit (e.g. 3 parallel actions)

### 5.3 TTL scheduler

`computeNextPollAfter(now): number` using rules from constants:

- Weekday → +4h
- Weekend before 15:00 Brussels → +1h
- Weekend after 15:00 → +15m

Optional: if registered club plays today, use shortest TTL.

### 5.4 Cron

```typescript
crons.interval("poll active competitions", { minutes: 5 }, internal.football.sync.syncActiveCompetitions);
```

The interval only **checks** due competitions; actual HTTP calls obey TTL.

### 5.5 Acceptance criteria

- [ ] Manual score change in API reflected after poll
- [ ] Kickoff change updates `footballMatches.kickoffAt`
- [ ] API call count ≤ active competitions per TTL window (log metrics)

---

## Phase 6 — Match preview automations

### 6.1 `internal.football.automations.schedulePreviewForMatch`

Compute `previewAt = snapToHour(kickoffAt - 48h, 10:00 Brussels)`.

If `previewAt` in future:

- `ctx.scheduler.runAt(previewAt, internal.football.automations.runPreview, { matchId, organizationId })`
- Upsert `footballAutomationRuns` status `scheduled`

### 6.2 `internal.football.automations.runPreview`

1. Load match + org profile.
2. Re-fetch competition or match API — abort if cancelled/postponed.
3. Check `organizationAutomations` enabled for `match_announcement`.
4. **MVP:** call existing `renderTemplateTest` pattern with real `MockMatchDto` mapping.
5. **Later:** social post + mark `posted`.

### 6.3 Reconciliation cron

Daily 05:00 Brussels:

- Find matches with kickoff in 47–49h lacking `footballAutomationRuns` for preview.
- Schedule missing jobs.

### 6.4 Acceptance criteria

- [ ] Fixture 4 days out gets `runAt` scheduled
- [ ] Kickoff change reschedules job (cancel old via new run + idempotency)
- [ ] Disabled automation → run records `skipped`

---

## Phase 7 — Match result automations

### 7.1 Result detection in `syncCompetition`

When upserting a match:

```typescript
if (wasNotFinished && nowFinished && involvesRegisteredClub) {
  await ctx.scheduler.runAfter(0, internal.football.automations.runResult, { matchId, organizationId });
}
```

### 7.2 `internal.football.automations.runResult`

1. Idempotency check on `footballAutomationRuns`.
2. Re-fetch match/competition.
3. Verify score present.
4. Map to template bindings (`homeScore`, `awayScore`, `score`).
5. Render + (later) post.

### 7.3 Weekend intensive polling

In `syncActiveCompetitions`, if `now` is Sat/Sun ≥ 15:00 Brussels:

- Filter active competitions with a registered club match today.
- Set `nextPollAfter = now + 15min` for those only.

### 7.4 Acceptance criteria

- [ ] When API returns new `Uitgespeeld` row, result automation fires once per org
- [ ] Re-poll with same score does not re-post
- [ ] Score correction updates DB and does not double-post (unless product wants correction posts — default: no)

---

## Phase 8 — Template binding integration

### 8.1 `lib/football/match-dto.ts`

Map `footballMatches` row + clubs → `MockMatchDto`:

| Binding | Source |
| --- | --- |
| `homeClubName` | `footballClubs.displayName` |
| `awayClubName` | idem |
| `matchDateTime` | `kickoffAt` formatted nl-BE |
| `matchAddress` | `venueAddress` or home club address |
| `homeClubLogo` / `awayClubLogo` | `logoUrl` from club or CDN pattern |
| `score` | `${homeGoals} - ${awayGoals}` |

### 8.2 Update render pipeline

Replace `DEFAULT_MOCK_MATCH` in production automations with DB-backed DTO.

### 8.3 Acceptance criteria

- [ ] Render test in editor still uses mock
- [ ] Automation run uses live data
- [ ] Missing logo falls back to placeholder crest (existing behavior)

---

## Phase 9 — Observability & ops

### 9.1 Logging

Log per sync: competition path, hash changed, matches updated, automations triggered.

### 9.2 Admin queries (internal)

- `internal.football.debug.getSyncStatus`
- Dashboard in Convex dashboard or future admin UI

### 9.3 Rate limit safety

- Centralize all HTTP in `apiClient.ts`
- Track `lastRequestAt` per competition
- Hard cap: max 1 request per competition per 10 minutes (safety below API TTL)

### 9.4 Acceptance criteria

- [ ] Sync failures recorded on `footballSyncJobs` / competition row
- [ ] Alerting hook ready (log error on 401)

---

## Phase 10 — Edge cases & hardening

| Case | Handling |
| --- | --- |
| Club plays twice same weekend (rare) | Dedupe by external id; show both in UI |
| Team suffix `B` | MVP: match `Mannen` only — filter rows where org club name matches without ` B` suffix rules |
| Competition relegation mid-season | Club endpoint refresh on new season cron |
| Org deleted | Cascade delete `organizationFootballProfile`, `footballAutomationRuns`; decrement competition active count |
| API 401 | Fail sync; surface ops alert |
| Match postponed | Status mapping → reschedule preview; suppress result |
| Forfeit | Store score as API provides; render literal result |

### Competition deactivation

When last registered org leaves a competition (or season ends):

- Set `syncTier=dormant`
- Stop polling; retain historical rows

---

## File change map (estimated)

| Area | Files |
| --- | --- |
| Schema | `convex/schema.ts` |
| Football module | `convex/football/**` |
| Onboarding | `convex/organizations/mutations.ts`, onboarding UI |
| Landing search | `components/landing/HeroClubSearch.tsx` |
| Template render | `convex/automations/actions.ts`, `lib/football/match-dto.ts` |
| Docs | `Documentation/football-data.md` (user-facing, post-MVP) |
| Scripts | `scripts/probe-voetbalinbelgie-api.ts` ✓ |
| Tests | `convex/football/parsers.test.ts`, `convex/football/sync.test.ts` |

---

## Suggested PR breakdown

| PR | Scope |
| --- | --- |
| PR1 | Phase 0–2: schema, api client, parsers, tests |
| PR2 | Phase 3–4: stamnummers + onboarding link |
| PR3 | Phase 5: competition sync + crons |
| PR4 | Phase 6–7: automation scheduling (render only, no social) |
| PR5 | Phase 8: template binding integration |
| PR6 | UI: club search + calendar view |

Keep each PR deployable; feature-flag automations until social posting exists.

---

## Testing strategy

### Unit tests

- Parser fixtures from API reference JSON
- Date/hash/dedupe helpers
- Status mapping `Uitgespeeld` → `finished`

### Integration (dev deployment)

1. Import stamnummers.
2. Link test org to KSV Aartselaar.
3. Verify match count for 2a competition.
4. Simulate hash change by patching a match locally + run sync.
5. Schedule preview for fixture 3 days out → verify `runAt` scheduled.

### Manual

```bash
pnpm probe:voetbal-api
npx convex run football/sync:importStamnummers
npx convex run football/sync:syncCompetition '{"apiPath":"/competities/2025-2026/antwerpen/mannen/2a/"}'
```

---

## Risks & mitigations

| Risk | Mitigation |
| --- | --- |
| API rows lack match ids | Parse from wedstrijd links in club endpoint or HTML fallback |
| Name mismatch home/away vs related links | Fuzzy match + manual override table (P2) |
| Convex scheduler limits at scale | Batch `runAt` + daily reconciliation |
| Too many competitions active | TTL polling + only Mannen + current season |
| Incorrect API data | Pre-post refresh + user feedback channel (future) |

---

## Definition of done (MVP data layer)

- [ ] Club search works from stamnummers
- [ ] Onboarding imports Mannen calendar for registered club
- [ ] Active competitions stay synced within API TTL rules
- [ ] Preview automations scheduled 48h before kickoff
- [ ] Result automations fire once when match finishes in API
- [ ] Template render receives real match data
- [ ] No duplicate matches when second club registers
- [ ] API reference doc contains live JSON samples

---

## Immediate next step

1. Run `pnpm probe:voetbal-api` on your machine and commit the populated API reference.
2. Start **PR1** with schema + `apiClient` + parsers, using probed JSON as test fixtures.
