/**
 * @vitest-environment node
 */
import { beforeAll, describe, expect, test } from "vitest";

import { createStarterSceneDocument } from "../scenes";
import { DEFAULT_MOCK_MATCH } from "../../../lib/template-scene/mock-match";
import { getFontUrlsForFamilies } from "../../../lib/template-scene/server-font-registry";

describe("server template render fonts", () => {
  test("manifest provides https urls for Pacifico", () => {
    const entries = getFontUrlsForFamilies(["Pacifico"]);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.family).toBe("Pacifico");
    expect(entries[0]?.urls.length).toBeGreaterThan(0);
    for (const url of entries[0]!.urls) {
      expect(url).toMatch(/^https:\/\//);
    }
  });

  test("maps system fonts to downloadable server sources", () => {
    const entries = getFontUrlsForFamilies([
      "Arial",
      "Times New Roman",
      "Pacifico",
    ]);
    expect(entries.map((entry) => entry.family)).toEqual([
      "Arial",
      "Times New Roman",
      "Pacifico",
    ]);
    for (const entry of entries) {
      expect(entry.urls.length).toBeGreaterThan(0);
    }
  });

  test("registerSceneFonts downloads Pacifico from remote urls", async () => {
    const { registerSceneFonts, resetRegisteredSceneFontsForTests } =
      await import("./register_scene_fonts");

    resetRegisteredSceneFontsForTests();
    await expect(registerSceneFonts(["Pacifico"])).resolves.toBeUndefined();
  });
});

describe("server template render pipeline", () => {
  beforeAll(() => {
    Object.assign(globalThis, {
      window: {
        addEventListener: () => {},
        removeEventListener: () => {},
      },
    });
  });

  test("renderTemplateToPng keeps distinct fonts per text element", async () => {
    const { renderTemplateToPng } = await import("./render_template_to_png");
    const { resetRegisteredSceneFontsForTests } =
      await import("./register_scene_fonts");

    resetRegisteredSceneFontsForTests();

    const scene = createStarterSceneDocument("instagram_square");
    const layer = scene.stage.children?.[0];
    layer?.children?.push(
      {
        className: "Text",
        attrs: {
          id: "arial-text",
          x: 80,
          y: 280,
          width: 920,
          text: "Arial sample ABCD 1234",
          fontFamily: "Arial",
          fontSize: 72,
          fill: "#111827",
        },
      },
      {
        className: "Text",
        attrs: {
          id: "pacifico-text",
          x: 80,
          y: 420,
          width: 920,
          text: "Pacifico sample ABCD",
          fontFamily: "Pacifico",
          fontSize: 72,
          fill: "#dc2626",
        },
      },
    );

    const png = await renderTemplateToPng({
      sceneDocument: scene,
      automationType: "match_result",
      canvasPreset: "instagram_square",
      match: DEFAULT_MOCK_MATCH,
      loaders: {
        loadAsset: async () => null,
      },
    });

    expect(png.byteLength).toBeGreaterThan(1000);
    expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  });

  test("renderTemplateToPng renders logo binding placeholders with crest artwork", async () => {
    const { renderTemplateToPng } = await import("./render_template_to_png");
    const { resetRegisteredSceneFontsForTests } =
      await import("./register_scene_fonts");
    const { resetPlaceholderCrestImageCacheForTests } =
      await import("./load_placeholder_crest");

    resetRegisteredSceneFontsForTests();
    resetPlaceholderCrestImageCacheForTests();

    const scene = createStarterSceneDocument("instagram_square");
    const layer = scene.stage.children?.[0];
    layer?.children?.push(
      {
        className: "Image",
        attrs: {
          id: "home-logo",
          x: 120,
          y: 320,
          width: 200,
          height: 200,
          bindingKey: "homeClubLogo",
        },
      },
      {
        className: "Image",
        attrs: {
          id: "away-logo",
          x: 760,
          y: 320,
          width: 200,
          height: 200,
          bindingKey: "awayClubLogo",
        },
      },
    );

    const png = await renderTemplateToPng({
      sceneDocument: scene,
      automationType: "match_result",
      canvasPreset: "instagram_square",
      match: DEFAULT_MOCK_MATCH,
      loaders: {
        loadAsset: async () => null,
      },
    });

    expect(png.byteLength).toBeGreaterThan(35000);

    const { Canvas, loadImage } = await import("skia-canvas");
    const rendered = await loadImage(png);
    const canvas = new Canvas(1080, 1080);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(rendered, 0, 0);
    const sampleHome = ctx.getImageData(220, 360, 1, 1).data;
    const sampleAway = ctx.getImageData(860, 360, 1, 1).data;

    expect(sampleHome[2]).toBeGreaterThan(150);
    expect(sampleHome[0]).toBeLessThan(sampleHome[2]);
    expect(sampleAway[0]).toBeGreaterThan(150);
    expect(sampleAway[0]).toBeGreaterThan(sampleAway[2]);
  });

  test("renderTemplateToPng renders text with a catalog google font", async () => {
    const { renderTemplateToPng } = await import("./render_template_to_png");
    const { resetRegisteredSceneFontsForTests } =
      await import("./register_scene_fonts");

    resetRegisteredSceneFontsForTests();

    const scene = createStarterSceneDocument("instagram_square");
    const layer = scene.stage.children?.[0];
    layer?.children?.push({
      className: "Text",
      attrs: {
        id: "pacifico-title",
        x: 80,
        y: 320,
        width: 920,
        text: "Pacifico render test",
        fontFamily: "Pacifico",
        fontSize: 96,
        fill: "#111827",
      },
    });

    const png = await renderTemplateToPng({
      sceneDocument: scene,
      automationType: "match_result",
      canvasPreset: "instagram_square",
      match: DEFAULT_MOCK_MATCH,
      loaders: {
        loadAsset: async () => null,
      },
    });

    expect(png.byteLength).toBeGreaterThan(1000);
    expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  });
});
