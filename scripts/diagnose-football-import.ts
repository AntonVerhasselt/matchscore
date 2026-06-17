/**
 * Diagnose missing competition team names vs club page parsing.
 * Usage: tsx scripts/diagnose-football-import.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  parseClubTeamsFromHtml,
  parseSportsClubJsonLd,
} from "../convex/lib/voetbalinbelgie/parseHtml";
import { collectRequiredTeamNames } from "../convex/lib/voetbalinbelgie/teamNames";
import {
  fetchClubPageHtml,
  fetchCompetitionJson,
} from "../convex/voetbalinbelgie/fetch";

const PATHS = [
  "/competities/2025-2026/antwerpen/mannen/2a/",
  "/competities/2025-2026/antwerpen/mannen/4a/",
] as const;

function loadApiKey(): string {
  const fromEnv = process.env.VOETBALINBELGIE_API_KEY?.trim();
  if (fromEnv) {
    return fromEnv;
  }

  const content = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  const match = content.match(/^VOETBALINBELGIE_API_KEY=(["']?)(.+?)\1\s*$/m);
  if (!match) throw new Error("VOETBALINBELGIE_API_KEY not found");
  return match[2].trim();
}

function slugFromHref(href: string): string {
  const url = new URL(href);
  const segments = url.pathname.split("/").filter(Boolean);
  return segments.at(-1) ?? "";
}

function slugPathFromHref(href: string): string {
  const url = new URL(href);
  return url.pathname.endsWith("/") ? url.pathname : `${url.pathname}/`;
}

async function main() {
  const apiKey = loadApiKey();

  for (const path of PATHS) {
    const dto = await fetchCompetitionJson(path, apiKey);

    console.log(`\n=== ${path} (id ${dto.meta.id}) ===`);

    const relatedByName = new Map(
      dto.relatedTeams.map((team) => [team.name, team]),
    );

    for (const apiName of collectRequiredTeamNames(dto)) {
      const related = relatedByName.get(apiName);
      if (!related?.href) {
        console.log(`- ${apiName}: no related href`);
        continue;
      }

      const slug = slugFromHref(related.href);
      const slugPath = slugPathFromHref(related.href).replace(
        /^\/clubs\//,
        "/clubs/",
      );
      const publicPath = slugPath.startsWith("/") ? slugPath : `/${slugPath}`;
      const html = await fetchClubPageHtml(publicPath);
      const sportsClub = parseSportsClubJsonLd(html);
      const parsedTeams = parseClubTeamsFromHtml(html, slug);
      const forCompetition = parsedTeams.filter(
        (team) => team.sourceCompetitionId === dto.meta.id,
      );

      const parsedNames = forCompetition.map((t) => t.teamName);
      const match = parsedNames.includes(apiName);

      console.log(
        JSON.stringify({
          apiName,
          slugPath: publicPath,
          jsonLdName: sportsClub?.name,
          parsedForCompetition: parsedNames,
          match,
          allParsedTeams: parsedTeams,
        }),
      );

      if (!match) {
        console.log(`  MISMATCH: expected "${apiName}"`);
      }
    }
  }
}

main().catch(console.error);
