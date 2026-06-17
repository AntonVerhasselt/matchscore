import type { TemplateMatchDto } from "@/lib/template-scene/template-match";

export type TemplateRenderClub = TemplateMatchDto["homeClub"] & {
  logoUrl: string | null;
};

/** Match sample for editor preview and server render test. */
export type TemplateRenderMatchData = Omit<TemplateMatchDto, "homeClub" | "awayClub"> & {
  homeClub: TemplateRenderClub;
  awayClub: TemplateRenderClub;
};
