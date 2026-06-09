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
import {
  getAvailableTextBindingKeys,
  resolveImageSource,
  resolveTextContent,
  normalizeSceneDocument,
} from "../../lib/template-scene";
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
      "match_announcement",
    );

    expect(scene.stage.children?.[0]?.children).toHaveLength(2);
  });

  test("rejects unsupported scene node classes", () => {
    const scene = createStarterSceneDocument("instagram_square");
    scene.stage.children?.[0]?.children?.push({
      className: "Circle" as "Rect",
      attrs: { x: 100, y: 100, radius: 50 },
    });

    expect(() =>
      normalizeSceneDocument(scene, "instagram_square", "match_announcement"),
    ).toThrow("Unsupported scene node class");
  });

  test("accepts image nodes with exactly one external content reference", () => {
    const scene = createStarterSceneDocument("instagram_square");
    scene.stage.children?.[0]?.children?.push({
      className: "Image",
      attrs: {
        id: "sponsor-logo",
        x: 40,
        y: 40,
        width: 160,
        height: 80,
        assetId: "asset_123",
      },
    });

    const normalized = normalizeSceneDocument(
      scene,
      "instagram_square",
      "match_announcement",
    );

    expect(normalized.stage.children?.[0]?.children?.[2]).toMatchObject({
      className: "Image",
      attrs: {
        assetId: "asset_123",
      },
    });
  });

  test("rejects image nodes without exactly one external content reference", () => {
    const withoutReference = createStarterSceneDocument("instagram_square");
    withoutReference.stage.children?.[0]?.children?.push({
      className: "Image",
      attrs: {
        id: "empty-image",
        x: 40,
        y: 40,
        width: 160,
        height: 80,
      },
    });

    const withBothReferences = createStarterSceneDocument("instagram_square");
    withBothReferences.stage.children?.[0]?.children?.push({
      className: "Image",
      attrs: {
        id: "ambiguous-image",
        x: 40,
        y: 40,
        width: 160,
        height: 80,
        assetId: "asset_123",
        bindingKey: "homeClubLogo",
      },
    });

    const withEmptyReference = createStarterSceneDocument("instagram_square");
    withEmptyReference.stage.children?.[0]?.children?.push({
      className: "Image",
      attrs: {
        id: "blank-image",
        x: 40,
        y: 40,
        width: 160,
        height: 80,
        assetId: " ",
      },
    });

    expect(() =>
      normalizeSceneDocument(
        withoutReference,
        "instagram_square",
        "match_announcement",
      ),
    ).toThrow("Image nodes require exactly one assetId or bindingKey");
    expect(() =>
      normalizeSceneDocument(
        withBothReferences,
        "instagram_square",
        "match_announcement",
      ),
    ).toThrow("Image nodes require exactly one assetId or bindingKey");
    expect(() =>
      normalizeSceneDocument(
        withEmptyReference,
        "instagram_square",
        "match_announcement",
      ),
    ).toThrow("Image nodes require exactly one assetId or bindingKey");
  });

  test("strips editor-only attrs", () => {
    const scene = createStarterSceneDocument("instagram_square");
    const textNode = scene.stage.children?.[0]?.children?.[1];
    if (!textNode) {
      throw new Error("Expected starter text node");
    }
    textNode.attrs.draggable = true;
    textNode.attrs.isSelected = true;

    const normalized = normalizeSceneDocument(
      scene,
      "instagram_square",
      "match_announcement",
    );
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

    expect(() =>
      normalizeSceneDocument(withFilter, "instagram_square", "match_announcement"),
    ).toThrow("Unsupported scene node attrs");
    expect(() =>
      normalizeSceneDocument(
        withSceneFunc,
        "instagram_square",
        "match_announcement",
      ),
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

    const normalized = normalizeSceneDocument(
      scene,
      "instagram_square",
      "match_announcement",
    );
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

    expect(() =>
      normalizeSceneDocument(scene, "instagram_square", "match_announcement"),
    ).toThrow("Scene document dimensions do not match canvas preset");
  });

  test("filters text binding keys by automation type", () => {
    expect(getAvailableTextBindingKeys("match_announcement")).toEqual([
      "homeClubName",
      "awayClubName",
      "homeAwayClubNames",
      "matchAddress",
      "matchDateTime",
    ]);
    expect(getAvailableTextBindingKeys("match_result")).toContain("score");
  });

  test("resolves fixed and bound text content", () => {
    expect(
      resolveTextContent(
        { text: "Static title" },
        "match_announcement",
        "design",
      ),
    ).toBe("Static title");
    expect(
      resolveTextContent(
        { bindingKey: "homeClubName" },
        "match_announcement",
        "design",
      ),
    ).toBe("{{ homeClubName }}");
    expect(
      resolveTextContent(
        { bindingKey: "homeAwayClubNames" },
        "match_announcement",
        "design",
      ),
    ).toBe("{{ homeClubName }} - {{ awayClubName }}");
    expect(
      resolveTextContent(
        { bindingKey: "homeAwayClubNames" },
        "match_announcement",
        "preview",
      ),
    ).toBe("KFC Eendracht - Sporting Zuid");
    expect(
      resolveTextContent(
        { bindingKey: "homeClubName" },
        "match_announcement",
        "preview",
      ),
    ).toBe("KFC Eendracht");
  });

  test("validates text binding keys for automation type", () => {
    const announcementScene = createStarterSceneDocument("instagram_square");
    const announcementText = announcementScene.stage.children?.[0]?.children?.[1];
    if (!announcementText) {
      throw new Error("Expected starter text node");
    }
    announcementText.attrs.bindingKey = "score";

    expect(() =>
      normalizeSceneDocument(
        announcementScene,
        "instagram_square",
        "match_announcement",
      ),
    ).toThrow("Invalid text bindingKey for automation type");

    const resultScene = createStarterSceneDocument("instagram_square");
    const resultText = resultScene.stage.children?.[0]?.children?.[1];
    if (!resultText) {
      throw new Error("Expected starter text node");
    }
    resultText.attrs.bindingKey = "score";

    const normalized = normalizeSceneDocument(
      resultScene,
      "instagram_square",
      "match_result",
    );
    const normalizedText = normalized.stage.children?.[0]?.children?.[1];

    expect(normalizedText?.attrs.bindingKey).toBe("score");
    expect(normalizedText?.attrs.text).toBeUndefined();
  });

  test("rejects binding keys on unsupported node classes", () => {
    const scene = createStarterSceneDocument("instagram_square");
    const rect = scene.stage.children?.[0]?.children?.[0];
    if (!rect) {
      throw new Error("Expected starter rect node");
    }
    rect.attrs.bindingKey = "homeClubName";

    expect(() =>
      normalizeSceneDocument(scene, "instagram_square", "match_announcement"),
    ).toThrow("bindingKey is only supported on Text and Image nodes");
  });

  test("validates dynamic image bindings and resolves placeholder sources", () => {
    const scene = createStarterSceneDocument("instagram_square");
    scene.stage.children?.[0]?.children?.push({
      className: "Image",
      attrs: {
        id: "home-logo",
        x: 40,
        y: 40,
        width: 160,
        height: 160,
        bindingKey: "homeClubLogo",
      },
    });

    const normalized = normalizeSceneDocument(
      scene,
      "instagram_square",
      "match_announcement",
    );
    const normalizedImage = normalized.stage.children?.[0]?.children?.[2];

    expect(normalizedImage?.attrs.bindingKey).toBe("homeClubLogo");
    expect(normalizedImage?.attrs.assetId).toBeUndefined();
    expect(
      resolveImageSource({ bindingKey: "homeClubLogo" }, "design"),
    ).toContain("data:image/svg+xml");
  });

  test("rejects text binding keys on image nodes", () => {
    const scene = createStarterSceneDocument("instagram_square");
    scene.stage.children?.[0]?.children?.push({
      className: "Image",
      attrs: {
        id: "invalid-image",
        x: 40,
        y: 40,
        width: 160,
        height: 160,
        bindingKey: "homeClubName",
      },
    });

    expect(() =>
      normalizeSceneDocument(scene, "instagram_square", "match_announcement"),
    ).toThrow("Invalid image bindingKey");
  });
});
