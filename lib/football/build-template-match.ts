import type { Id } from "@/convex/_generated/dataModel";
import type { TemplateMatchDto } from "@/lib/template-scene/template-match";
import { formatTeamAddress, type FootballTeamAddress } from "./format-team-address";

export type BuildTemplateMatchInput = {
  kickoffAt: number;
  status: string;
  homeGoals?: number;
  awayGoals?: number;
  resultText?: string;
  homeTeam: {
    name: string;
    logoStorageId?: Id<"_storage">;
    address?: FootballTeamAddress;
  };
  awayTeam: {
    name: string;
    logoStorageId?: Id<"_storage">;
  };
};

export function buildTemplateMatch(
  input: BuildTemplateMatchInput,
): TemplateMatchDto {
  return {
    homeClub: {
      name: input.homeTeam.name,
      logoStorageId: input.homeTeam.logoStorageId,
    },
    awayClub: {
      name: input.awayTeam.name,
      logoStorageId: input.awayTeam.logoStorageId,
    },
    address: formatTeamAddress(input.homeTeam.address),
    kickoffAt: input.kickoffAt,
    homeScore: input.homeGoals,
    awayScore: input.awayGoals,
    status: input.status,
    resultText: input.resultText,
  };
}
