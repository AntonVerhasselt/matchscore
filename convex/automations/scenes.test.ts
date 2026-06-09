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
import { createStarterSceneDocument, normalizeSceneDocument } from "./scenes";

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

    const layer = scene.stage.children?.[0];
    if (!layer?.children) {
      throw new Error("Expected starter layer with children");
    }
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

  test("normalizes a minimal Stage/Layer/Rect/Text scene", () => {
    const scene = normalizeSceneDocument(
      {
        schemaVersion: 1,
        stage: {
          className: "Stage",
          attrs: { width: 1080, height: 1080 },
          children: [
            {
              className: "Layer",
              attrs: {},
              children: [
                {
                  className: "Rect",
                  attrs: {
                    id: "background",
                    x: 0,
                    y: 0,
                    width: 1080,
                    height: 1080,
                    fill: "#111827",
                  },
                },
                {
                  className: "Text",
                  attrs: {
                    id: "title",
                    x: 80,
                    y: 80,
                    width: 920,
                    text: "Matchscore template",
                    fontSize: 64,
                    fill: "#ffffff",
                  },
                },
              ],
            },
          ],
        },
      },
      "instagram_square",
    );

    expect(scene.stage.children?.[0]?.children).toHaveLength(2);
  });

  test("rejects unsupported scene node classes", () => {
    const scene = createStarterSceneDocument("instagram_square");
    scene.stage.children?.[0]?.children?.push({
      className: "Circle" as "Rect",
      attrs: { x: 100, y: 100, radius: 50 },
    });

    expect(() => normalizeSceneDocument(scene, "instagram_square")).toThrow(
      "Unsupported scene node class",
    );
  });

  test("strips editor-only attrs", () => {
    const scene = createStarterSceneDocument("instagram_square");
    const textNode = scene.stage.children?.[0]?.children?.[1];
    if (!textNode) {
      throw new Error("Expected starter text node");
    }
    textNode.attrs.draggable = true;
    textNode.attrs.isSelected = true;

    const normalized = normalizeSceneDocument(scene, "instagram_square");
    const normalizedTextNode = normalized.stage.children?.[0]?.children?.[1];

    expect(normalizedTextNode?.attrs.draggable).toBeUndefined();
    expect(normalizedTextNode?.attrs.isSelected).toBeUndefined();
  });

  test("rejects filters and custom scene functions", () => {
    const withFilter = createStarterSceneDocument("instagram_square");
    const withSceneFunc = createStarterSceneDocument("instagram_square");
    const rectWithFilter = withFilter.stage.children?.[0]?.children?.[0];
    const rectWithSceneFunc = withSceneFunc.stage.children?.[0]?.children?.[0];
    if (!rectWithFilter || !rectWithSceneFunc) {
      throw new Error("Expected starter rect nodes");
    }
    rectWithFilter.attrs.filters = ["Blur"];
    rectWithSceneFunc.attrs.sceneFunc = () => null;

    expect(() => normalizeSceneDocument(withFilter, "instagram_square")).toThrow(
      "Unsupported scene node attrs",
    );
    expect(() =>
      normalizeSceneDocument(withSceneFunc, "instagram_square"),
    ).toThrow("Unsupported scene node attrs");
  });

  test("bakes scale into dimensions", () => {
    const scene = createStarterSceneDocument("instagram_square");
    const rect = scene.stage.children?.[0]?.children?.[0];
    if (!rect) {
      throw new Error("Expected starter rect node");
    }
    rect.attrs.width = 100;
    rect.attrs.height = 50;
    rect.attrs.scaleX = 2;
    rect.attrs.scaleY = 3;

    const normalized = normalizeSceneDocument(scene, "instagram_square");
    const normalizedRect = normalized.stage.children?.[0]?.children?.[0];

    expect(normalizedRect?.attrs.width).toBe(200);
    expect(normalizedRect?.attrs.height).toBe(150);
    expect(normalizedRect?.attrs.scaleX).toBeUndefined();
    expect(normalizedRect?.attrs.scaleY).toBeUndefined();
  });

  test("rejects scenes with dimensions that do not match the canvas preset", () => {
    const scene = createStarterSceneDocument("instagram_square");
    scene.stage.attrs.width = 1200;
    scene.stage.attrs.height = 630;

    expect(() => normalizeSceneDocument(scene, "instagram_square")).toThrow(
      "Scene document dimensions do not match canvas preset",
    );
  });
});
