import type {
  AutomationTypeSlug,
  MockSocialAccount,
  MockTemplate,
} from "@/lib/automations/types";

export const MOCK_SOCIAL_ACCOUNTS: MockSocialAccount[] = [
  {
    platform: "facebook",
    connected: true,
    channels: { posts: true, story: false },
  },
  {
    platform: "instagram",
    connected: false,
    channels: { posts: false, story: false },
  },
];

const MOCK_TEMPLATES_BY_TYPE: Record<AutomationTypeSlug, MockTemplate[]> = {
  result: [
    {
      id: "tpl_result_classic",
      name: "Klassieke score",
      canvasPreset: "instagram_square",
      updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 2,
    },
    {
      id: "tpl_result_bold",
      name: "Grote cijfers",
      canvasPreset: "instagram_square",
      updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 5,
    },
    {
      id: "tpl_result_fb",
      name: "Facebook breed",
      canvasPreset: "facebook_landscape",
      updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 12,
    },
  ],
  preview: [
    {
      id: "tpl_preview_matchday",
      name: "Matchday aankondiging",
      canvasPreset: "instagram_square",
      updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 3,
    },
    {
      id: "tpl_preview_portrait",
      name: "Portret tegenstander",
      canvasPreset: "instagram_portrait",
      updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 8,
    },
  ],
};

export function getMockTemplatesForType(
  automationType: AutomationTypeSlug,
): MockTemplate[] {
  return [...MOCK_TEMPLATES_BY_TYPE[automationType]];
}
