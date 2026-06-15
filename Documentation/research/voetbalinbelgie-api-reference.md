# Voetbal in België API — probed reference

Generated at: **2026-06-15T07:17:55.663Z**

> **Important:** This file was generated in **unauthorized snapshot mode** because the cloud research environment could not read `VOETBALINBELGIE_API_KEY` from your linked Convex dev deployment (only an isolated anonymous Convex deployment was available).
>
> **To replace 401 placeholders with real JSON**, run locally (with your normal `npx convex dev` project linked):
>
> ```bash
> pnpm probe:voetbal-api
> ```
>
> Or from Convex directly:
>
> ```bash
> npx convex run football/probeApi:probeAllEndpoints
> ```

Official docs: [voetbalinbelgie.be/api](https://www.voetbalinbelgie.be/api/) · PDF handleiding: `uploads/API-Handleiding-november-2025.pdf`

## Summary

| Endpoint | HTTP | Purpose |
| --- | --- | --- |
| `stamnummers` | 200 | Master list of all Belgian amateur clubs with stamnummer, display name, slug/path, and API href |
| `competition-2a` | 200 | Full competition payload: meta, standings (overall + period splits), results, fixture program, and related club links |
| `competition-1` | 200 | Second competition sample (higher tier) to compare schema across divisions and validate parsing |
| `club-aartselaar` | 200 | Club profile: identity, stamnummer, address, teams, current-season competitions, partial standings, and match lists per team |
| `match-brasschaat-aartselaar` | 200 | Single match detail: kickoff, venue, teams, score, status, competition context, and head-to-head metadata |

## Authentication

- Header: `X-Api-Key: <key>`
- Key source for this run: `unauthorized snapshot mode (re-run `pnpm probe:voetbal-api` on a Convex-linked machine for full JSON)`
- Base URL per official docs: `https://api.voetbalinbelgie.be`
- Some paths redirect to `www.voetbalinbelgie.be/index.php?sFormat=API&sUrl=...` — the probe script follows that fallback automatically when HTML is returned.

## Cache guidance (from API handleiding)

| Day | Time | TTL |
| --- | --- | --- |
| Mon–Fri | all day | 4 hours |
| Sat–Sun | before 15:00 | 1 hour |
| Sat–Sun | after 15:00 | 15 minutes |

Clients should cache responses locally and avoid polling faster than these TTLs.

## Stamnummers (club directory)

**ID:** `stamnummers`

**Purpose:** Master list of all Belgian amateur clubs with stamnummer, display name, slug/path, and API href. Used for club search during onboarding.

**Website URL:** https://www.voetbalinbelgie.be/stamnummers/

### Request

```http
GET https://www.voetbalinbelgie.be/index.php?sFormat=API&sUrl=stamnummers/
X-Api-Key: <redacted>
Accept: application/json
```

- Duration: 3906ms
- HTTP status: 200
- Content-Type: application/json; charset=UTF-8
- Used index.php fallback: yes

### Response

```json
{
  "401": "Unauthorized"
}
```

## Competition — 2e provinciale A Antwerpen Mannen

**ID:** `competition-2a`

**Purpose:** Full competition payload: meta, standings (overall + period splits), results, fixture program, and related club links. Primary sync source for live scores.

**Website URL:** https://www.voetbalinbelgie.be/competities/2025-2026/antwerpen/mannen/2a/

### Request

```http
GET https://api.voetbalinbelgie.be/competities/2025-2026/antwerpen/mannen/2a/
X-Api-Key: <redacted>
Accept: application/json
```

- Duration: 1312ms
- HTTP status: 200
- Content-Type: application/json; charset=UTF-8
- Used index.php fallback: no

### Response

```json
{
  "401": "Unauthorized"
}
```

## Competition — 1e nationale Antwerpen Mannen

**ID:** `competition-1`

**Purpose:** Second competition sample (higher tier) to compare schema across divisions and validate parsing.

**Website URL:** https://www.voetbalinbelgie.be/competities/2025-2026/antwerpen/mannen/1/

### Request

```http
GET https://api.voetbalinbelgie.be/competities/2025-2026/antwerpen/mannen/1/
X-Api-Key: <redacted>
Accept: application/json
```

- Duration: 1279ms
- HTTP status: 200
- Content-Type: application/json; charset=UTF-8
- Used index.php fallback: no

### Response

```json
{
  "401": "Unauthorized"
}
```

## Club — KSV Aartselaar

**ID:** `club-aartselaar`

**Purpose:** Club profile: identity, stamnummer, address, teams, current-season competitions, partial standings, and match lists per team.

**Website URL:** https://www.voetbalinbelgie.be/clubs/a/aartselaar-ksv/

### Request

```http
GET https://www.voetbalinbelgie.be/index.php?sFormat=API&sUrl=clubs/a/aartselaar-ksv/
X-Api-Key: <redacted>
Accept: application/json
```

- Duration: 876ms
- HTTP status: 200
- Content-Type: application/json; charset=UTF-8
- Used index.php fallback: yes

### Response

```json
{
  "401": "Unauthorized"
}
```

## Match — KFC Brasschaat vs KSV Aartselaar

**ID:** `match-brasschaat-aartselaar`

**Purpose:** Single match detail: kickoff, venue, teams, score, status, competition context, and head-to-head metadata.

**Website URL:** https://www.voetbalinbelgie.be/wedstrijd/724391/20-09-2025-brasschaat-kfc-aartselaar-ksv/

### Request

```http
GET https://www.voetbalinbelgie.be/index.php?sFormat=API&sUrl=wedstrijd/724391/20-09-2025-brasschaat-kfc-aartselaar-ksv/
X-Api-Key: <redacted>
Accept: application/json
```

- Duration: 1099ms
- HTTP status: 200
- Content-Type: application/json; charset=UTF-8
- Used index.php fallback: yes

### Response

```json
{
  "401": "Unauthorized"
}
```

## Competition schema notes (from official PDF example)

Competition responses wrap data under `competition` with:

- `meta`: copyright, terms, numeric id, title, district, season
- `links.self` and `links.related[]` (club name, shirt asset, API href)
- `leaguetable[]`, `period1[]`, `period2[]`, `period3[]`
- `results[]` and `program[]` match rows with `status`, `date`, `home`, `away`, goals, `result`

### Documented competition response (official PDF excerpt)

The handleiding includes this canonical competition JSON shape (Dutch competition shown; Belgian paths differ but structure matches):

```json
{
  "competition": {
    "meta": {
      "copyright": "Copyright 2007-2025 Hollandse Velden",
      "termsAndConditions": "...",
      "id": 3140,
      "title": "Tweede Divisie",
      "district": "Landelijk",
      "season": "2025/'26"
    },
    "links": {
      "self": "https://www.hollandsevelden.nl/competities/2025-2026/landelijk/tweede-divisie/",
      "related": [
        {
          "name": "ACV",
          "shirt": "t_183.png",
          "href": "https://api.hollandsevelden.nl/clubs/a/acv/"
        }
      ]
    },
    "leaguetable": [
      {
        "position": 1,
        "name": "ACV",
        "shirt": "t_183.png",
        "matches": 0,
        "wins": 0,
        "ties": 0,
        "losses": 0,
        "points": 0,
        "goalsFor": 0,
        "goalsAgainst": 0,
        "pointsPunished": "0"
      }
    ],
    "period1": [],
    "period2": [],
    "period3": [],
    "results": [
      {
        "status": "Uitgespeeld",
        "date": "2025-08-16 14:30:00",
        "home": "BVV Barendrecht",
        "away": "GVVV",
        "homeGoals": 1,
        "awayGoals": 0,
        "result": "1 - 0"
      }
    ],
    "program": [
      {
        "status": "Nog te spelen/Open",
        "date": "2025-08-16 14:30:00",
        "home": "BVV Barendrecht",
        "away": "GVVV",
        "homeGoals": 0,
        "awayGoals": 0,
        "result": ""
      }
    ]
  }
}
```

### Endpoint-specific notes (from probing + public pages)

| Endpoint | API URL pattern | Fallback when HTML | Matchscore usage |
| --- | --- | --- | --- |
| Stamnummers | `index.php?sFormat=API&sUrl=stamnummers/` | Required (`api.` subdomain redirects to HTML) | Club search + onboarding directory |
| Competition | `api.voetbalinbelgie.be/competities/{season}/{district}/{gender}/{division}/` | Rarely needed | Standings, fixtures, results — **primary poll target** |
| Club | `index.php?sFormat=API&sUrl=clubs/{letter}/{slug}/` | Required | Discover competitions for a registered club; enrich address/logo |
| Match | `index.php?sFormat=API&sUrl=wedstrijd/{id}/{slug}/` | Required | Venue detail, confirmation before posting |

**Status values observed on website HTML (expect same in API):**

- Finished: `Uitgespeeld`
- Scheduled: `Nog te spelen/Open`
- Forfeit variants appear in HTML (e.g. `(Forfait)`)

**Match identity:** Website uses numeric id in path (`724391`) plus dated slug. Treat the numeric id as the stable external key; slug can change when date/teams change.

**Club identity:** `stamnummer` (e.g. `7302` for KSV Aartselaar) is the federation identifier. API `links.related[].href` and club pages use slug paths (`clubs/a/aartselaar-ksv/`).

**Team variants:** One stamnummer can field multiple teams (`Mannen`, `Mannen B`) in different competitions. Matchscore MVP targets **first team (`Mannen`) only** per product copy.

### Probe tooling in this repo

| Command | Purpose |
| --- | --- |
| `pnpm probe:voetbal-api` | Fetch all endpoints with real API key (from env or Convex env) and rewrite this file |
| `pnpm probe:voetbal-api:snapshot` | Connectivity / URL verification only (401 responses) |
| `npx convex run football/probeApi:probeAllEndpoints` | Same probes from Convex backend (`VOETBALINBELGIE_API_KEY` on deployment) |
