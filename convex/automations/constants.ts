export const AUTOMATION_TYPES = ["match_announcement", "match_result"] as const;

export const TEMPLATE_COUNT_CAP = 1000;

export const CANVAS_PRESETS = [
  "instagram_square",
  "instagram_portrait",
  "facebook_landscape",
] as const;

export type AutomationType = (typeof AUTOMATION_TYPES)[number];
export type CanvasPreset = (typeof CANVAS_PRESETS)[number];

export const POSTING_CHANNELS = [
  "facebookPagePost",
  "facebookPageStory",
  "instagramProfilePost",
  "instagramProfileStory",
] as const;

export type PostingChannel = (typeof POSTING_CHANNELS)[number];

export type PostingChannelStatuses = Record<PostingChannel, boolean>;

export const DEFAULT_POSTING_CHANNEL_STATUSES: PostingChannelStatuses = {
  facebookPagePost: true,
  facebookPageStory: true,
  instagramProfilePost: true,
  instagramProfileStory: true,
};

export function normalizePostingChannelStatuses(
  postingChannels?: Partial<PostingChannelStatuses> | null,
): PostingChannelStatuses {
  return {
    facebookPagePost:
      postingChannels?.facebookPagePost ??
      DEFAULT_POSTING_CHANNEL_STATUSES.facebookPagePost,
    facebookPageStory:
      postingChannels?.facebookPageStory ??
      DEFAULT_POSTING_CHANNEL_STATUSES.facebookPageStory,
    instagramProfilePost:
      postingChannels?.instagramProfilePost ??
      DEFAULT_POSTING_CHANNEL_STATUSES.instagramProfilePost,
    instagramProfileStory:
      postingChannels?.instagramProfileStory ??
      DEFAULT_POSTING_CHANNEL_STATUSES.instagramProfileStory,
  };
}

export function getEffectivePostingChannelStatuses(
  isGloballyEnabled: boolean,
  postingChannels: PostingChannelStatuses,
): PostingChannelStatuses {
  if (isGloballyEnabled) {
    return postingChannels;
  }

  return {
    facebookPagePost: false,
    facebookPageStory: false,
    instagramProfilePost: false,
    instagramProfileStory: false,
  };
}

export const CANVAS_PRESET_DIMENSIONS: Record<
  CanvasPreset,
  { width: number; height: number }
> = {
  instagram_square: { width: 1080, height: 1080 },
  instagram_portrait: { width: 1080, height: 1350 },
  facebook_landscape: { width: 1200, height: 630 },
};
