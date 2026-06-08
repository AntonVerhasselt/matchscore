import { describe, expect, test } from "vitest";
import {
  AUTOMATION_TYPES,
  CANVAS_PRESET_DIMENSIONS,
  CANVAS_PRESETS,
  DEFAULT_POSTING_CHANNEL_STATUSES,
  getEffectivePostingChannelStatuses,
  normalizePostingChannelStatuses,
  POSTING_CHANNELS,
} from "./constants";
import { createStarterSceneDocument } from "./scenes";

describe("automation phase 1 foundations", () => {
  test("defines exactly the two MVP automation types", () => {
    expect(AUTOMATION_TYPES).toEqual(["match_announcement", "match_result"]);
  });

  test("defines the fixed canvas presets", () => {
    expect(CANVAS_PRESETS).toEqual([
      "instagram_square",
      "instagram_portrait",
      "facebook_landscape",
    ]);
    expect(CANVAS_PRESET_DIMENSIONS.instagram_square).toEqual({
      width: 1080,
      height: 1080,
    });
  });

  test("defaults all posting channels to active", () => {
    expect(POSTING_CHANNELS).toEqual([
      "facebookPagePost",
      "facebookPageStory",
      "instagramProfilePost",
      "instagramProfileStory",
    ]);
    expect(DEFAULT_POSTING_CHANNEL_STATUSES).toEqual({
      facebookPagePost: true,
      facebookPageStory: true,
      instagramProfilePost: true,
      instagramProfileStory: true,
    });
  });

  test("global inactive status overrides posting channel statuses", () => {
    expect(
      getEffectivePostingChannelStatuses(false, {
        facebookPagePost: true,
        facebookPageStory: false,
        instagramProfilePost: true,
        instagramProfileStory: false,
      }),
    ).toEqual({
      facebookPagePost: false,
      facebookPageStory: false,
      instagramProfilePost: false,
      instagramProfileStory: false,
    });
  });

  test("normalizes missing posting channel statuses to defaults", () => {
    expect(
      normalizePostingChannelStatuses({
        facebookPagePost: false,
      }),
    ).toEqual({
      facebookPagePost: false,
      facebookPageStory: true,
      instagramProfilePost: true,
      instagramProfileStory: true,
    });
  });

  test("creates a valid starter scene for the selected canvas preset", () => {
    const scene = createStarterSceneDocument("facebook_landscape");

    expect(scene.schemaVersion).toBe(1);
    expect(scene.stage.className).toBe("Stage");
    expect(scene.stage.attrs).toEqual({ width: 1200, height: 630 });
    expect(scene.stage.children).toHaveLength(1);

    const layer = scene.stage.children[0];
    expect(layer.className).toBe("Layer");
    expect(layer.children).toHaveLength(2);
    expect(layer.children[0]).toMatchObject({
      className: "Rect",
      attrs: {
        id: "background",
        width: 1200,
        height: 630,
        fill: "#111827",
      },
    });
    expect(layer.children[1]).toMatchObject({
      className: "Text",
      attrs: {
        id: "title",
        text: "Matchscore template",
        fill: "#ffffff",
      },
    });
  });
});
