/**
 * Probes VoetbalInBelgië public HTML + authenticated JSON endpoints and writes
 * Documentation/voetbalinbelgie-api-samples.md with request/response samples.
 *
 * Usage: pnpm test:voetbalinbelgie-api
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const PUBLIC_BASE = "https://www.voetbalinbelgie.be";
const API_BASE = "https://api.voetbalinbelgie.be";

const SAMPLE_CLUB_PATHS = [
  "/clubs/a/aartselaar-ksv/",
  "/clubs/b/berchem-sport-k/",
  "/clubs/a/antwerp-fc-r/",
] as const;

const SAMPLE_COMPETITION_PATHS = [
  "/competities/2025-2026/antwerpen/mannen/2a/",
  "/competities/2025-2026/antwerpen/mannen/4a/",
] as const;

type ApiSample = {
  id: string;
  purpose: string;
  method: string;
  url: string;
  auth: string;
  status: number;
  contentType: string;
  body: string;
  notes?: string[];
};

function loadApiKey(): string {
  const envPath = resolve(process.cwd(), ".env.local");
  const content = readFileSync(envPath, "utf8");
  const match = content.match(/^VOETBALINBELGIE_API_KEY=(.+)$/m);
  if (!match) {
    throw new Error("VOETBALINBELGIE_API_KEY not found in .env.local");
  }
  return match[1].trim();
}

function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}\n\n… [truncated ${text.length - maxChars} chars] …`;
}

function parseStamnummers(html: string) {
  const entries: Array<{ stamnummer: string; path: string; name: string }> =
    [];
  const re =
    /<dt class="col-sm-4">Stamnummer (\d+)<\/dt>\s*<dd class="col-sm-8"><a href="(\/clubs\/[^"]+)">[\s\S]*?<\/a>&nbsp;<a href="\2">([^<]+)<\/a><\/dd>/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    entries.push({
      stamnummer: match[1],
      path: match[2],
      name: match[3],
    });
  }
  return entries;
}

function parseClubTeams(html: string, slug: string) {
  const jsonLdMatch = html.match(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/,
  );
  if (!jsonLdMatch) return [];

  const jsonLd = JSON.parse(jsonLdMatch[1]) as {
    "@graph": Array<Record<string, unknown>>;
  };
  const base = jsonLd["@graph"].find(
    (node) => node["@type"] === "SportsClub",
  ) as Record<string, unknown> | undefined;

  const tabs = [...html.matchAll(/href="#comp-(\d+)"[^>]*>([^<]+)<\/a>/g)];
  return tabs.map((tab) => {
    const compDomId = tab[1];
    const start = html.indexOf(`id="comp-${compDomId}"`);
    const nextIndices = [...html.matchAll(/id="comp-\d+"/g)]
      .map((m) => m.index ?? -1)
      .filter((index) => index > start + 5);
    const end =
      nextIndices.length > 0 ? Math.min(...nextIndices) : start + 25_000;
    const block = html.slice(start, end);
    const competitionPath = block.match(
      /href="(\/competities\/2025-2026[^"#]+)"/,
    )?.[1];
    const rows = [...block.matchAll(/<td class="club">([\s\S]*?)<\/td>/g)];
    const ownRow = rows.find((row) => row[1].includes(slug));
    const teamName =
      ownRow?.[1]
        ?.match(/>&nbsp;([^<]+)<\/a>/)
        ?.[1]
        ?.trim() ??
      ownRow?.[1]
        ?.match(/alt="Clublogo voetbalvereniging ([^"]+)"/)
        ?.[1]
        ?.trim();

    return {
      tabLabel: tab[2].trim(),
      sourceCompetitionId: Number(compDomId),
      competitionPath,
      teamName,
      stamnummer: base?.branchCode,
    };
  });
}

function extractSportsClubJsonLd(html: string): unknown {
  const jsonLdMatch = html.match(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/,
  );
  if (!jsonLdMatch) return null;
  const jsonLd = JSON.parse(jsonLdMatch[1]) as {
    "@graph": Array<Record<string, unknown>>;
  };
  return jsonLd["@graph"].find((node) => node["@type"] === "SportsClub") ?? null;
}

function formatSampleSection(sample: ApiSample): string {
  const notes =
    sample.notes && sample.notes.length > 0
      ? `\n**Notes:**\n${sample.notes.map((note) => `- ${note}`).join("\n")}\n`
      : "";

  return `## ${sample.id}

**Purpose:** ${sample.purpose}

| | |
|---|---|
| Method | \`${sample.method}\` |
| URL | \`${sample.url}\` |
| Auth | ${sample.auth} |
| Status | ${sample.status} |
| Content-Type | ${sample.contentType} |

${notes}
### Response

\`\`\`${sample.contentType.includes("json") ? "json" : "html"}\n${sample.body}\n\`\`\`

---
`;
}

async function fetchSample(
  id: string,
  purpose: string,
  url: string,
  options: { auth?: string; headers?: Record<string, string>; notes?: string[] } = {},
): Promise<ApiSample> {
  const response = await fetch(url, { headers: options.headers });
  const contentType = response.headers.get("content-type") ?? "unknown";
  const rawBody = await response.text();

  return {
    id,
    purpose,
    method: "GET",
    url,
    auth: options.auth ?? "None",
    status: response.status,
    contentType,
    body: rawBody,
    notes: options.notes,
  };
}

async function main() {
  const apiKey = loadApiKey();
  const samples: ApiSample[] = [];

  const stamnummersUrl = `${PUBLIC_BASE}/stamnummers/`;
  const stamnummersResponse = await fetch(stamnummersUrl);
  const stamnummersHtml = await stamnummersResponse.text();
  const stamnummersEntries = parseStamnummers(stamnummersHtml);

  samples.push({
    id: "1 — Stamnummers (club index)",
    purpose:
      "Public HTML index of all registered clubs. Provides stamnummer, display name, and club detail path for follow-up requests. Used for the one-time club/team import.",
    method: "GET",
    url: stamnummersUrl,
    auth: "None",
    status: stamnummersResponse.status,
    contentType:
      stamnummersResponse.headers.get("content-type") ?? "text/html",
    body: truncate(stamnummersHtml, 8_000),
    notes: [
      `Parsed ${stamnummersEntries.length} clubs from full HTML.`,
      `First parsed entry: ${JSON.stringify(stamnummersEntries[0])}`,
      `Aartselaar entry: ${JSON.stringify(stamnummersEntries.find((entry) => entry.path.includes("aartselaar")))}`,
      "Each `<dt>Stamnummer</dt><dd>` pair links to `/clubs/{letter}/{slug}/`.",
    ],
  });

  for (const [index, clubPath] of SAMPLE_CLUB_PATHS.entries()) {
    const url = `${PUBLIC_BASE}${clubPath}`;
    const response = await fetch(url);
    const html = await response.text();
    const slug = clubPath.split("/").filter(Boolean).pop() ?? "";
    const teams = parseClubTeams(html, slug);
    const sportsClub = extractSportsClubJsonLd(html);

    samples.push({
      id: `${index + 2} — Club detail (${slug})`,
      purpose:
        "Public HTML club page with contact details, logo, JSON-LD metadata, and one tab per active team (first team, second team, …). Each tab links to the competition path for that team.",
      method: "GET",
      url,
      auth: "None",
      status: response.status,
      contentType: response.headers.get("content-type") ?? "text/html",
      body: truncate(html, 10_000),
      notes: [
        `Parsed teams: ${JSON.stringify(teams, null, 2)}`,
        `JSON-LD SportsClub: ${JSON.stringify(sportsClub, null, 2)}`,
        "Logo URL is available in JSON-LD `logo` and `<meta property=\"og:image\">`.",
        "Match H2H links on the page use `/wedstrijd/{numericId}/…` but those IDs are not present in the competition JSON API.",
      ],
    });
  }

  for (const [index, competitionPath] of SAMPLE_COMPETITION_PATHS.entries()) {
    const url = `${API_BASE}${competitionPath}`;
    const response = await fetch(url, {
      headers: { "X-Api-Key": apiKey },
    });
    const jsonText = await response.text();
    let parsedNotes: string[] = [];
    if (response.ok) {
      const parsed = JSON.parse(jsonText) as {
        competition: Record<string, unknown>;
      };
      const competition = parsed.competition;
      parsedNotes = [
        `meta.id (source competition id): ${(competition.meta as { id: number }).id}`,
        `meta.title: ${(competition.meta as { title: string }).title}`,
        `leaguetable rows: ${(competition.leaguetable as unknown[]).length}`,
        `results rows: ${(competition.results as unknown[]).length}`,
        `program rows: ${(competition.program as unknown[]).length}`,
        `period1 rows: ${(competition.period1 as unknown[]).length} (skip storing)`,
        `First leaguetable row: ${JSON.stringify((competition.leaguetable as unknown[])[0])}`,
        `First results row: ${JSON.stringify((competition.results as unknown[])[0])}`,
        `First related club: ${JSON.stringify((competition.links as { related: unknown[] }).related[0])}`,
      ];
    }

    samples.push({
      id: `${index + 5} — Competition JSON (${competitionPath})`,
      purpose:
        "Authenticated JSON endpoint returning competition metadata, general ranking (`leaguetable`), period rankings (`period1`–`period4`, skip), finished/upcoming matches (`results` + `program`), and participating teams (`links.related`).",
      method: "GET",
      url,
      auth: "Header `X-Api-Key` (VOETBALINBELGIE_API_KEY)",
      status: response.status,
      contentType: response.headers.get("content-type") ?? "application/json",
      body: truncate(jsonText, 12_000),
      notes: parsedNotes,
    });
  }

  const markdown = `# VoetbalInBelgië API — live samples

Generated by \`pnpm test:voetbalinbelgie-api\` on ${new Date().toISOString()}.

This file captures real request/response samples from the VoetbalInBelgië public HTML endpoints and authenticated competition JSON API. Use it alongside \`Documentation/voetbalinbelgie-api-research.md\` and \`plans/voetbal-data-integration.md\`.

## Endpoint overview

| # | Endpoint | Format | Auth | Used for |
|---|----------|--------|------|----------|
| 1 | \`GET /stamnummers/\` | HTML | No | Discover all clubs (stamnummer + path) |
| 2–4 | \`GET /clubs/{letter}/{slug}/\` | HTML | No | Club contact info, logo, teams, competition links |
| 5–6 | \`GET /competities/{season}/{district}/{gender}/{class}/\` | JSON | \`X-Api-Key\` | Ranking, calendar, results |

## Parsed summary (full HTML responses truncated below)

### Stamnummers index

- Total clubs parsed: **${stamnummersEntries.length}**
- Sample: \`${JSON.stringify(stamnummersEntries.slice(0, 3))}\`

### Club teams extracted from sample pages

${SAMPLE_CLUB_PATHS.map((path) => {
  const slug = path.split("/").filter(Boolean).pop() ?? "";
  return `- \`${path}\`: see section notes below`;
}).join("\n")}

### Competition paths currently allowed by API key

- \`/competities/2025-2026/antwerpen/mannen/2a/\` (meta.id **389**)
- \`/competities/2025-2026/antwerpen/mannen/4a/\` (meta.id **394**)

---

${samples.map(formatSampleSection).join("\n")}
`;

  const outputPath = resolve(
    process.cwd(),
    "Documentation/voetbalinbelgie-api-samples.md",
  );
  writeFileSync(outputPath, markdown, "utf8");
  console.log(`Wrote ${outputPath}`);
  console.log(`Samples: ${samples.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
