import type { Id } from "@/convex/_generated/dataModel";

export type TemplateMatchClub = {
  name: string;
  logoStorageId?: Id<"_storage">;
};

/** Match data resolved at render time from synced football tables. */
export type TemplateMatchDto = {
  homeClub: TemplateMatchClub;
  awayClub: TemplateMatchClub;
  address: string;
  kickoffAt: number;
  homeScore?: number;
  awayScore?: number;
  status?: string;
  resultText?: string;
};
