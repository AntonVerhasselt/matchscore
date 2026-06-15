/**
 * Probes Voetbal in België API endpoints and writes a single markdown reference file.
 *
 * API key resolution order:
 * 1. VOETBALINBELGIE_API_KEY environment variable
 * 2. `npx convex env get VOETBALINBELGIE_API_KEY` (uses linked Convex dev deployment)
 *
 * Usage:
 *   pnpm probe:voetbal-api
 *   # or
 *   VOETBALINBELGIE_API_KEY=... tsx scripts/probe-voetbalinbelgie-api.ts
 */

import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const API_BASE = "https://api.voetbalinbelgie.be";
const OUTPUT_PATH = join(
  process.cwd(),
  "Documentation/research/voetbalinbelgie-api-reference.md",
);

type EndpointProbe = {
  id: string;
  name: string;
  purpose: string;
  websitePath: string;
  apiPath: string;
};

const ENDPOINTS: EndpointProbe[] = [
  {
    id: "stamnummers",
    name: "Stamnummers (club directory)",
    purpose:
      "Master list of all Belgian amateur clubs with stamnummer, display name, slug/path, and API href. Used for club search during onboarding.",
    websitePath: "/stamnummers/",
    apiPath: "/stamnummers/",
  },
  {
    id: "competition-2a",
    name: "Competition — 2e provinciale A Antwerpen Mannen",
    purpose:
      "Full competition payload: meta, standings (overall + period splits), results, fixture program, and related club links. Primary sync source for live scores.",
    websitePath: "/competities/2025-2026/antwerpen/mannen/2a/",
    apiPath: "/competities/2025-2026/antwerpen/mannen/2a/",
  },
  {
    id: "competition-1",
    name: "Competition — 1e nationale Antwerpen Mannen",
    purpose:
      "Second competition sample (higher tier) to compare schema across divisions and validate parsing.",
    websitePath: "/competities/2025-2026/antwerpen/mannen/1/",
    apiPath: "/competities/2025-2026/antwerpen/mannen/1/",
  },
  {
    id: "club-aartselaar",
    name: "Club — KSV Aartselaar",
    purpose:
      "Club profile: identity, stamnummer, address, teams, current-season competitions, partial standings, and match lists per team.",
    websitePath: "/clubs/a/aartselaar-ksv/",
    apiPath: "/clubs/a/aartselaar-ksv/",
  },
  {
    id: "match-brasschaat-aartselaar",
    name: "Match — KFC Brasschaat vs KSV Aartselaar",
    purpose:
      "Single match detail: kickoff, venue, teams, score, status, competition context, and head-to-head metadata.",
    websitePath:
      "/wedstrijd/724391/20-09-2025-brasschaat-kfc-aartselaar-ksv/",
    apiPath: "/wedstrijd/724391/20-09-2025-brasschaat-kfc-aartselaar-ksv/",
  },
];

function resolveApiKey(): string {
  if (process.env.VOETBALINBELGIE_API_KEY?.trim()) {
    return process.env.VOETBALINBELGIE_API_KEY.trim();
  }

  try {
    const value = execSync("npx convex env get VOETBALINBELGIE_API_KEY", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
    if (value && !value.startsWith("✖")) {
      return value;
    }
  } catch {
    // Fall through to explicit error below.
  }

  throw new Error(
    "VOETBALINBELGIE_API_KEY not found. Set it in your Convex dev deployment (`npx convex env set VOETBALINBELGIE_API_KEY ...`) or export it in the shell.",
  );
}

function buildApiUrl(apiPath: string): string {
  return `${API_BASE}${apiPath}`;
}

function isProbablyHtml(body: string): boolean {
  const trimmed = body.trimStart();
  return trimmed.startsWith("<!DOCTYPE") || trimmed.startsWith("<html");
}

async function fetchEndpoint(
  apiKey: string,
  endpoint: EndpointProbe,
): Promise<{
  requestUrl: string;
  status: number;
  contentType: string | null;
  body: string;
  parsedJson: unknown | null;
  usedFallback: boolean;
}> {
  const requestUrl = buildApiUrl(endpoint.apiPath);
  const headers = {
    "X-Api-Key": apiKey,
    Accept: "application/json",
  };

  let response = await fetch(requestUrl, {
    headers,
    redirect: "follow",
  });
  let body = await response.text();
  let usedFallback = false;

  if (isProbablyHtml(body)) {
    const fallbackUrl = `https://www.voetbalinbelgie.be/index.php?sFormat=API&sUrl=${encodeURIComponent(endpoint.apiPath.replace(/^\//, ""))}`;
    usedFallback = true;
    response = await fetch(fallbackUrl, { headers, redirect: "follow" });
    body = await response.text();
  }

  let parsedJson: unknown | null = null;
  try {
    parsedJson = JSON.parse(body);
  } catch {
    parsedJson = null;
  }

  return {
    requestUrl: usedFallback
      ? `https://www.voetbalinbelgie.be/index.php?sFormat=API&sUrl=${endpoint.apiPath.replace(/^\//, "")}`
      : requestUrl,
    status: response.status,
    contentType: response.headers.get("content-type"),
    body,
    parsedJson,
    usedFallback,
  };
}

function formatJsonBlock(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function truncateForMarkdown(body: string, maxChars = 120_000): string {
  if (body.length <= maxChars) {
    return body;
  }
  return `${body.slice(0, maxChars)}\n\n... truncated (${body.length - maxChars} additional characters) ...`;
}

function buildMarkdown(
  apiKeySource: string,
  results: Array<{
    endpoint: EndpointProbe;
    result: Awaited<ReturnType<typeof fetchEndpoint>>;
    durationMs: number;
  }>,
): string {
  const generatedAt = new Date().toISOString();
  const lines: string[] = [
    "# Voetbal in België API — probed reference",
    "",
    `Generated at: **${generatedAt}**`,
    "",
    "Official docs: [voetbalinbelgie.be/api](https://www.voetbalinbelgie.be/api/)",
    "",
    "## Summary",
    "",
    "| Endpoint | HTTP | Purpose |",
    "| --- | --- | --- |",
  ];

  for (const { endpoint, result } of results) {
    lines.push(
      `| \`${endpoint.id}\` | ${result.status} | ${endpoint.purpose.split(".")[0]} |`,
    );
  }

  lines.push(
    "",
    "## Authentication",
    "",
    "- Header: `X-Api-Key: <key>`",
    `- Key source for this run: \`${apiKeySource}\``,
    "- Base URL per official docs: `https://api.voetbalinbelgie.be`",
    "- Some paths redirect to `www.voetbalinbelgie.be/index.php?sFormat=API&sUrl=...` — the probe script follows that fallback automatically when HTML is returned.",
    "",
    "## Cache guidance (from API handleiding)",
    "",
    "| Day | Time | TTL |",
    "| --- | --- | --- |",
    "| Mon–Fri | all day | 4 hours |",
    "| Sat–Sun | before 15:00 | 1 hour |",
    "| Sat–Sun | after 15:00 | 15 minutes |",
    "",
    "Clients should cache responses locally and avoid polling faster than these TTLs.",
    "",
  );

  for (const { endpoint, result, durationMs } of results) {
    lines.push(`## ${endpoint.name}`, "");
    lines.push(`**ID:** \`${endpoint.id}\``, "");
    lines.push(`**Purpose:** ${endpoint.purpose}`, "");
    lines.push(
      `**Website URL:** https://www.voetbalinbelgie.be${endpoint.websitePath}`,
      "",
    );
    lines.push("### Request", "");
    lines.push("```http", `GET ${result.requestUrl}`, "X-Api-Key: <redacted>", "Accept: application/json", "```", "");
    lines.push(
      `- Duration: ${durationMs}ms`,
      `- HTTP status: ${result.status}`,
      `- Content-Type: ${result.contentType ?? "unknown"}`,
      `- Used index.php fallback: ${result.usedFallback ? "yes" : "no"}`,
      "",
    );
    lines.push("### Response", "");
    if (result.parsedJson !== null) {
      lines.push("```json", truncateForMarkdown(formatJsonBlock(result.parsedJson)), "```", "");
    } else {
      lines.push(
        "```",
        truncateForMarkdown(result.body),
        "```",
        "",
        "> Response was not valid JSON.",
        "",
      );
    }
  }

  lines.push(
    "## Competition schema notes (from official PDF example)",
    "",
    "Competition responses wrap data under `competition` with:",
    "",
    "- `meta`: copyright, terms, numeric id, title, district, season",
    "- `links.self` and `links.related[]` (club name, shirt asset, API href)",
    "- `leaguetable[]`, `period1[]`, `period2[]`, `period3[]`",
    "- `results[]` and `program[]` match rows with `status`, `date`, `home`, `away`, goals, `result`",
    "",
  );

  return lines.join("\n");
}

async function main(): Promise<void> {
  const allowUnauthorized =
    process.argv.includes("--unauthorized-snapshot") ||
    process.env.PROBE_ALLOW_UNAUTHORIZED === "1";

  let apiKey: string;
  let apiKeySource: string;

  try {
    apiKey = resolveApiKey();
    apiKeySource = process.env.VOETBALINBELGIE_API_KEY
      ? "VOETBALINBELGIE_API_KEY env var"
      : "npx convex env get VOETBALINBELGIE_API_KEY";
  } catch (error) {
    if (!allowUnauthorized) {
      throw error;
    }
    apiKey = "invalid-probe-key";
    apiKeySource =
      "unauthorized snapshot mode (re-run `pnpm probe:voetbal-api` on a Convex-linked machine for full JSON)";
  }

  const results: Array<{
    endpoint: EndpointProbe;
    result: Awaited<ReturnType<typeof fetchEndpoint>>;
    durationMs: number;
  }> = [];

  for (const endpoint of ENDPOINTS) {
    const started = Date.now();
    const result = await fetchEndpoint(apiKey, endpoint);
    results.push({
      endpoint,
      result,
      durationMs: Date.now() - started,
    });
    console.log(`${endpoint.id}: HTTP ${result.status} (${Date.now() - started}ms)`);
  }

  const markdown = buildMarkdown(apiKeySource, results);
  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, markdown, "utf8");
  console.log(`Wrote ${OUTPUT_PATH}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
