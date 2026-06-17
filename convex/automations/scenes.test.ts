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
  calculateObjectFit,
  calculateTextFit,
  collectSceneAssetIds,
  displayText,
  resolveImageSource,
  resolveTextContent,
  normalizeSceneDocument,
} from "../../lib/template-scene";
import {
  formatBinding,
  formatMatchDateTime,
  formatScore,
} from "../../lib/template-scene/format-binding";
import {
  DEFAULT_MOCK_MATCH,
  DEFAULT_MOCK_MATCH_KICKOFF_AT,
} from "../../lib/template-scene/mock-match";
import { prepareImageLayout, prepareTextForRender } from "../../lib/template-scene/prepare-render-node";
import { getFontUrlsForFamilies, assertTemplateFontManifestUsesRemoteUrls } from "../../lib/template-scene/server-font-registry";
import { createStarterSceneDocument } from "./scenes";
import {
  normalizeHexColor,
  pickContrastingTextColor,
  relativeLuminance,
  resolveSceneBackgroundFill,
} from "../../lib/template-scene/color-contrast";

describe("template scene color contrast", () => {
  test("picks black text on light backgrounds", () => {
    expect(pickContrastingTextColor("#ffffff")).toBe("#000000");
    expect(pickContrastingTextColor("#fef3c7")).toBe("#000000");
  });

  test("picks white text on dark backgrounds", () => {
    expect(pickContrastingTextColor("#000000")).toBe("#ffffff");
    expect(pickContrastingTextColor("#111827")).toBe("#ffffff");
    expect(pickContrastingTextColor("#1e3a8a")).toBe("#ffffff");
  });

  test("normalizes shorthand and missing hash hex values", () => {
    expect(normalizeHexColor("fff")).toBe("#ffffff");
    expect(normalizeHexColor("#ABC")).toBe("#aabbcc");
    expect(normalizeHexColor("not-a-color")).toBeNull();
  });

  test("resolves solid and image background fills", () => {
    const scene = createStarterSceneDocument("instagram_square");
    const background = scene.stage.children?.[0]?.children?.[0] ?? null;
    expect(resolveSceneBackgroundFill(background)).toBe("#ffffff");
    expect(relativeLuminance("#ffffff")).toBeGreaterThan(0.55);
  });
});

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
        fill: "#ffffff",
      },
    });
    expect(layer.children[1]).toMatchObject({
      className: "Text",
      attrs: {
        id: "title",
        text: "Matchscore template",
        fill: "#111827",
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
                    fill: "#ffffff",
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
      className: "Path" as "Rect",
      attrs: { id: "path-1", data: "M0 0" },
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
    textNode.attrs.listening = false;
    textNode.attrs.overlayLayer = true;

    const normalized = normalizeSceneDocument(
      scene,
      "instagram_square",
      "match_announcement",
    );
    const normalizedTextNode = normalized.stage.children?.[0]?.children?.[1];

    expect(normalizedTextNode?.attrs.draggable).toBeUndefined();
    expect(normalizedTextNode?.attrs.isSelected).toBeUndefined();
    expect(normalizedTextNode?.attrs.listening).toBeUndefined();
    expect(normalizedTextNode?.attrs.overlayLayer).toBeUndefined();
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
      resolveTextContent({ text: "Static title" }, "match_announcement"),
    ).toBe("Static title");
    expect(
      resolveTextContent(
        { bindingKey: "homeClubName" },
        "match_announcement",
      ),
    ).toBe("KFC Eendracht");
    expect(
      resolveTextContent(
        { bindingKey: "homeAwayClubNames" },
        "match_announcement",
      ),
    ).toBe("KFC Eendracht - Sporting Zuid");
  });

  test("applies uppercase text transform to fixed and bound text", () => {
    expect(displayText("Matchscore", { textTransform: "uppercase" })).toBe(
      "MATCHSCORE",
    );
    expect(
      resolveTextContent(
        { bindingKey: "homeClubName", textTransform: "uppercase" },
        "match_announcement",
      ),
    ).toBe("KFC EENDRACHT");
  });

  test("validates phase 5 text and layer attrs", () => {
    const scene = createStarterSceneDocument("instagram_square");
    const textNode = scene.stage.children?.[0]?.children?.[1];
    if (!textNode) {
      throw new Error("Expected starter text node");
    }
    textNode.attrs.name = "Headline";
    textNode.attrs.visible = false;
    textNode.attrs.locked = true;
    textNode.attrs.overflowMode = "shrink";
    textNode.attrs.textTransform = "uppercase";
    textNode.attrs.align = "center";
    textNode.attrs.lineHeight = 1.2;
    textNode.attrs.fontFamily = "Montserrat";
    textNode.attrs.fontStyle = "bold italic";
    textNode.attrs.textDecoration = "underline";

    const normalized = normalizeSceneDocument(
      scene,
      "instagram_square",
      "match_announcement",
    );
    const normalizedText = normalized.stage.children?.[0]?.children?.[1];

    expect(normalizedText?.attrs).toMatchObject({
      name: "Headline",
      visible: false,
      locked: true,
      overflowMode: "shrink",
      textTransform: "uppercase",
      align: "center",
      lineHeight: 1.2,
      fontFamily: "Montserrat",
      fontStyle: "bold italic",
      textDecoration: "underline",
    });
  });

  test("rejects invalid phase 5 attrs", () => {
    const invalidTextTransform = createStarterSceneDocument("instagram_square");
    const invalidVisible = createStarterSceneDocument("instagram_square");
    const invalidRectOverflow = createStarterSceneDocument("instagram_square");
    const textNode = invalidTextTransform.stage.children?.[0]?.children?.[1];
    const visibleNode = invalidVisible.stage.children?.[0]?.children?.[1];
    const rectNode = invalidRectOverflow.stage.children?.[0]?.children?.[0];
    if (!textNode || !visibleNode || !rectNode) {
      throw new Error("Expected starter nodes");
    }
    textNode.attrs.textTransform = "lowercase";
    visibleNode.attrs.visible = "no";
    rectNode.attrs.overflowMode = "wrap";

    expect(() =>
      normalizeSceneDocument(
        invalidTextTransform,
        "instagram_square",
        "match_announcement",
      ),
    ).toThrow("Invalid textTransform");
    expect(() =>
      normalizeSceneDocument(
        invalidVisible,
        "instagram_square",
        "match_announcement",
      ),
    ).toThrow("Scene node visible attr must be a boolean");
    expect(() =>
      normalizeSceneDocument(
        invalidRectOverflow,
        "instagram_square",
        "match_announcement",
      ),
    ).toThrow("overflowMode is only supported on Text nodes");
  });

  test("rejects invalid text style attrs", () => {
    const scene = createStarterSceneDocument("instagram_square");
    const textNode = scene.stage.children?.[0]?.children?.[1];
    if (!textNode) {
      throw new Error("Expected starter text node");
    }
    textNode.attrs.fontStyle = "oblique";
    textNode.attrs.textDecoration = "line-through";

    expect(() =>
      normalizeSceneDocument(scene, "instagram_square", "match_announcement"),
    ).toThrow("Invalid text fontStyle");

    textNode.attrs.fontStyle = "bold";
    textNode.attrs.textDecoration = "line-through";

    expect(() =>
      normalizeSceneDocument(scene, "instagram_square", "match_announcement"),
    ).toThrow("Invalid text textDecoration");
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
      resolveImageSource({ bindingKey: "homeClubLogo" }),
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

  test("calculates cover object fit crop rectangles", () => {
    expect(calculateObjectFit(2000, 1000, 1080, 1080, "cover")).toEqual({
      crop: { x: 500, y: 0, width: 1000, height: 1000 },
      render: { x: 0, y: 0, width: 1080, height: 1080 },
    });
  });

  test("calculates contain object fit render rectangles", () => {
    expect(calculateObjectFit(2000, 1000, 1080, 1080, "contain")).toEqual({
      crop: { x: 0, y: 0, width: 2000, height: 1000 },
      render: { x: 0, y: 270, width: 1080, height: 540 },
    });
  });

  test("calculates text shrink-to-fit with a mock measure function", () => {
    const fontSize = calculateTextFit(
      "Matchscore",
      "Arial",
      120,
      24,
      48,
      (text, size) => ({
        width: text.length * size * 0.5,
        height: size,
      }),
    );

    expect(fontSize).toBe(24);
  });

  test("collects static asset references from scene documents", () => {
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

    expect(collectSceneAssetIds(scene)).toEqual(["asset_123"]);
  });
});

describe("automation phase 6 server render prep", () => {
  test("formats binding text from mock match data with nl-BE locale", () => {
    expect(formatBinding("homeClubName", DEFAULT_MOCK_MATCH, "nl-BE")).toBe(
      "KFC Eendracht",
    );
    expect(formatBinding("homeAwayClubNames", DEFAULT_MOCK_MATCH, "nl-BE")).toBe(
      "KFC Eendracht - Sporting Zuid",
    );
    expect(formatBinding("score", DEFAULT_MOCK_MATCH, "nl-BE")).toBe("2 - 1");
    expect(formatMatchDateTime(DEFAULT_MOCK_MATCH_KICKOFF_AT, "nl-BE")).toMatch(
      /2025/,
    );
    expect(formatScore(DEFAULT_MOCK_MATCH)).toBe("2 - 1");
  });

  test("prepares bound text for server render", () => {
    const prepared = prepareTextForRender(
      {
        bindingKey: "homeClubName",
        fontSize: 48,
        width: 400,
      },
      "match_result",
      DEFAULT_MOCK_MATCH,
    );

    expect(prepared.text).toBe("KFC Eendracht");
    expect(prepared.fontSize).toBe(48);
  });

  test("prepares background image layout as full-frame cover", () => {
    const layout = prepareImageLayout(
      {
        id: "background",
        width: 1080,
        height: 1080,
        objectFit: "contain",
      },
      2000,
      1000,
    );

    expect(layout.render).toEqual({ x: 0, y: 0, width: 1080, height: 1080 });
  });

  test("returns no font urls for unknown families", () => {
    expect(getFontUrlsForFamilies(["Comic Sans MS"])).toEqual([]);
  });

  test("returns downloadable urls for system and catalog families", () => {
    const entries = getFontUrlsForFamilies(["Arial", "Montserrat"]);
    expect(entries).toHaveLength(2);
    expect(entries[0]?.family).toBe("Arial");
    expect(entries[1]?.family).toBe("Montserrat");
  });

  test("font manifest uses remote https urls for convex runtime loading", () => {
    assertTemplateFontManifestUsesRemoteUrls();
  });
});

describe("template shape presets", () => {
  test("accepts expanded Konva shape classes in scene documents", () => {
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
                  className: "Circle",
                  attrs: {
                    id: "circle-1",
                    x: 200,
                    y: 200,
                    radius: 80,
                    fill: "#111827",
                  },
                },
                {
                  className: "Star",
                  attrs: {
                    id: "star-1",
                    x: 500,
                    y: 500,
                    numPoints: 5,
                    innerRadius: 30,
                    outerRadius: 80,
                    fill: "#dc2626",
                  },
                },
                {
                  className: "Line",
                  attrs: {
                    id: "line-1",
                    x: 100,
                    y: 100,
                    points: [0, 0, 240, 0],
                    stroke: "#111827",
                    strokeWidth: 4,
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

    const layerChildren = scene.stage.children?.[0]?.children ?? [];
    expect(layerChildren.map((node) => node.className)).toEqual([
      "Circle",
      "Star",
      "Line",
    ]);
  });

  test("normalizes legacy multi-point lines to two vertices on save", () => {
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
                  className: "Line",
                  attrs: {
                    id: "line-legacy",
                    x: 40,
                    y: 40,
                    points: [0, 0, 200, 100],
                    stroke: "#111827",
                    strokeWidth: 4,
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

    expect(scene.stage.children?.[0]?.children?.[0]?.attrs.points).toEqual([
      0, 0, 200, 100,
    ]);
  });

  test("normalizes legacy three-point lines to start and end vertices on save", () => {
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
                  className: "Line",
                  attrs: {
                    id: "line-legacy-3pt",
                    x: 40,
                    y: 40,
                    points: [0, 0, 120, 0, 240, 0],
                    stroke: "#111827",
                    strokeWidth: 4,
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

    expect(scene.stage.children?.[0]?.children?.[0]?.attrs.points).toEqual([
      0, 0, 240, 0,
    ]);
  });

  test("normalizes legacy multi-point lines to first and last vertices on save", () => {
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
                  className: "Line",
                  attrs: {
                    id: "line-legacy-polyline",
                    x: 0,
                    y: 0,
                    points: [0, 0, 50, 0, 100, 50, 200, 100],
                    stroke: "#111827",
                    strokeWidth: 4,
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

    expect(scene.stage.children?.[0]?.children?.[0]?.attrs.points).toEqual([
      0, 0, 200, 100,
    ]);
  });

  test("rejects unsupported Konva classes", () => {
    expect(() =>
      normalizeSceneDocument(
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
                    className: "Path",
                    attrs: { id: "path-1", data: "M0 0" },
                  },
                ],
              },
            ],
          },
        },
        "instagram_square",
        "match_announcement",
      ),
    ).toThrow("Unsupported scene node class");
  });
});
