/**
 * Diagnose missing allowlisted competition teams vs club page parsing.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { fetchClubPageHtml, fetchCompetitionJson } from "../convex/voetbalinbelgie/fetch";
import { parseClubTeamsFromHtml, parseSportsClubJsonLd } from "../convex/lib/voetbalinbelgie/parseHtml";

function loadApiKey(): string {
  const content = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  const match = content.match(/^VOETBALINBELGIE_API_KEY=(.+)$/m);
  if (!match) throw new Error("Missing VOETBALINBELGIE_API_KEY");
  return match[1].trim();
}

function slugFromPath(slugPath: string): string {
  return slugPath.split("/").filter(Boolean).at(-1) ?? "";
}

const paths = [
  "/competities/2025-2026/antwerpen/mannen/2a/",
  "/competities/2025-2026/antwerpen/mannen/4a/",
];

async function main() {
  const apiKey = loadApiKey();

  for (const path of paths) {
    const dto = await fetchCompetitionJson(path, apiKey);
    console.log(`\n=== ${path} (id ${dto.meta.id}) ===`);

    for (const related of dto.relatedTeams) {
      const href = related.href ?? "";
      const slugPathMatch = href.match(/\/clubs\/[^/]+\/[^/]+\/?$/);
      if (!slugPathMatch) {
        console.log(`- ${related.name}: no club path in ${href}`);
        continue;
      }

      const slugPath = slugPathMatch[0].endsWith("/")
        ? slugPathMatch[0]
        : `${slugPathMatch[0]}/`;
      const slug = slugFromPath(slugPath);
      const html = await fetchClubPageHtml(slugPath);
      const sportsClub = parseSportsClubJsonLd(html);
      const teams = parseClubTeamsFromHtml(html, slug);
      const match = teams.find(
        (team) =>
          team.sourceCompetitionId === dto.meta.id &&
          team.teamName === related.name,
      );

      if (!match) {
        console.log(`MISSING MATCH: API="${related.name}" path=${slugPath}`);
        console.log(
          `  parsed for comp ${dto.meta.id}:`,
          teams
            .filter((t) => t.sourceCompetitionId === dto.meta.id)
            .map((t) => t.teamName),
        );
        console.log(
          `  all parsed:`,
          teams.map((t) => ({
            name: t.teamName,
            comp: t.sourceCompetitionId,
            tab: t.tabLabel,
          })),
        );
        console.log(`  JSON-LD name: ${sportsClub?.name}`);
      }
    }
  }
}

main().catch(console.error);
