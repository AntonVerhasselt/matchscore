import type { Id } from "@/convex/_generated/dataModel";

/** URL segment under `/app/automations/[automationType]`. */
export type AutomationTypeSlug = "result" | "preview";

/** Convex `automationType` value (future wiring). */
export type AutomationTypeBackend = "match_result" | "match_announcement";

export const AUTOMATION_TYPE_SLUGS = ["result", "preview"] as const;

/** Display order on the overview page — result first. */
export const AUTOMATION_TYPE_ORDER: AutomationTypeSlug[] = ["result", "preview"];

export type SocialPlatform = "facebook" | "instagram";

export type SocialChannel = "posts" | "story";

export type PostingChannel =
  | "facebookPagePost"
  | "facebookPageStory"
  | "instagramProfilePost"
  | "instagramProfileStory";

export type PostingChannelStatuses = Record<PostingChannel, boolean>;

export type CanvasPreset =
  | "instagram_square"
  | "instagram_portrait"
  | "facebook_landscape";

export type MockSocialAccount = {
  platform: SocialPlatform;
  connected: boolean;
  channels: Record<SocialChannel, boolean>;
};

export type MockTemplate = {
  id: string;
  name: string;
  canvasPreset: CanvasPreset;
  updatedAt: number;
};

export type AutomationSummary = {
  _id: Id<"organizationAutomations">;
  automationType: AutomationTypeBackend;
  isGloballyEnabled: boolean;
  postingChannels: PostingChannelStatuses;
  effectivePostingChannels: PostingChannelStatuses;
  updatedAt: number;
  updatedByUserId: string | null;
  templateCount: number;
  templateCountIsCapped: boolean;
};

export type AutomationTemplateSummary = {
  _id: Id<"automationTemplates">;
  name: string;
  automationType: AutomationTypeBackend;
  canvasPreset: CanvasPreset;
  schemaVersion: number;
  updatedAt: number;
};

const SLUG_TO_BACKEND: Record<AutomationTypeSlug, AutomationTypeBackend> = {
  result: "match_result",
  preview: "match_announcement",
};

const BACKEND_TO_SLUG: Record<AutomationTypeBackend, AutomationTypeSlug> = {
  match_result: "result",
  match_announcement: "preview",
};

export function isAutomationTypeSlug(v: string): v is AutomationTypeSlug {
  return (AUTOMATION_TYPE_SLUGS as readonly string[]).includes(v);
}

export function toBackendAutomationType(
  slug: AutomationTypeSlug,
): AutomationTypeBackend {
  return SLUG_TO_BACKEND[slug];
}

export function toAutomationTypeSlug(
  backend: AutomationTypeBackend,
): AutomationTypeSlug {
  return BACKEND_TO_SLUG[backend];
}

export function automationTemplatesPath(slug: AutomationTypeSlug): string {
  return `/app/automations/${slug}`;
}

export function automationEditorPath(
  slug: AutomationTypeSlug,
  templateId: string,
): string {
  return `/app/automations/${slug}/${templateId}`;
}

export function isEditorRoute(pathname: string): boolean {
  return /^\/app\/automations\/(result|preview)\/[^/]+$/.test(pathname);
}

export function toPostingChannel(
  platform: SocialPlatform,
  channel: SocialChannel,
): PostingChannel {
  if (platform === "facebook" && channel === "posts") {
    return "facebookPagePost";
  }
  if (platform === "facebook" && channel === "story") {
    return "facebookPageStory";
  }
  if (platform === "instagram" && channel === "posts") {
    return "instagramProfilePost";
  }
  return "instagramProfileStory";
}
