import type { ActionCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import {
  parseClubTeamsFromHtml,
  parseProvinceFromHtml,
  parseSportsClubJsonLd,
} from "../lib/voetbalinbelgie/parseHtml";
import { applyDisplayNameDisambiguationToParsedTeams } from "../lib/voetbalinbelgie/disambiguateTeamNames";
import type { StamnummerEntry } from "../lib/voetbalinbelgie/types";
import { fetchClubPageHtml } from "../voetbalinbelgie/fetch";
import { normalizeLogoSourceUrl } from "../voetbalinbelgie/logos";
import { downloadLogoToStorage, slugFromPath } from "./logoImport";

export async function importClubPage(
  ctx: ActionCtx,
  entry: Pick<StamnummerEntry, "slugPath">,
): Promise<{ teamCount: number; teamNames: string[] }> {
  const html = await fetchClubPageHtml(entry.slugPath);
  const sportsClub = parseSportsClubJsonLd(html);
  if (!sportsClub) {
    throw new Error("missing SportsClub JSON-LD");
  }

  const slug = slugFromPath(entry.slugPath);
  const province = parseProvinceFromHtml(html);
  const parsedTeams = applyDisplayNameDisambiguationToParsedTeams(
    parseClubTeamsFromHtml(html, slug),
  );

  let logoStorageId = undefined;
  let logoSourceUrl = undefined;
  if (sportsClub.logo) {
    logoSourceUrl = normalizeLogoSourceUrl(sportsClub.logo);
    logoStorageId = await downloadLogoToStorage(ctx, sportsClub.logo);
  }

  for (const parsedTeam of parsedTeams) {
    await ctx.runMutation(internal.football.internalMutations.upsertFootballTeam, {
      name: parsedTeam.displayName,
      vibTeamName: parsedTeam.vibTeamName,
      stamnummer: parsedTeam.stamnummer ?? sportsClub.branchCode,
      slugPath: entry.slugPath,
      slug,
      parentStamnummer: sportsClub.branchCode,
      sourceCompetitionId: parsedTeam.sourceCompetitionId,
      competitionPath: parsedTeam.competitionPath,
      tabLabel: parsedTeam.tabLabel,
      website: sportsClub.url,
      telephone: sportsClub.telephone,
      address: sportsClub.address,
      province,
      logoStorageId,
      logoSourceUrl,
      importSource: "club_page",
    });
  }

  return {
    teamCount: parsedTeams.length,
    teamNames: parsedTeams.map((team) => team.displayName),
  };
}

export function slugPathFromApiHref(href: string): string {
  const url = new URL(href);
  return url.pathname.endsWith("/") ? url.pathname : `${url.pathname}/`;
}
