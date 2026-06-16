import { describe, expect, test } from "vitest";

import { createStarterSceneDocument } from "../../convex/automations/scenes";
import { normalizeSceneDocument } from "./index";

import { hashTemplateThumbnailContent, countRenderableSceneImages } from "./thumbnail-capture";

describe("hashTemplateThumbnailContent", () => {
  test("returns the same hash for identical normalized scene documents", async () => {
    const raw = createStarterSceneDocument("instagram_square");
    const sceneDocument = normalizeSceneDocument(
      raw,
      "instagram_square",
      "match_result",
    );

    const first = await hashTemplateThumbnailContent("Team template", sceneDocument);
    const second = await hashTemplateThumbnailContent("Team template", sceneDocument);

    expect(first).toBe(second);
    expect(first).toHaveLength(64);
  });

  test("returns different hashes when the template name changes", async () => {
    const raw = createStarterSceneDocument("instagram_square");
    const sceneDocument = normalizeSceneDocument(
      raw,
      "instagram_square",
      "match_result",
    );

    const first = await hashTemplateThumbnailContent("Team template", sceneDocument);
    const second = await hashTemplateThumbnailContent("Basic template", sceneDocument);

    expect(first).not.toBe(second);
  });

  test("counts image nodes in a scene document", () => {
    const raw = createStarterSceneDocument("instagram_square");
    const sceneDocument = normalizeSceneDocument(
      raw,
      "instagram_square",
      "match_result",
    );

    expect(countRenderableSceneImages(sceneDocument)).toBe(0);
  });
});
