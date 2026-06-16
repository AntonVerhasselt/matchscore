/**
 * Local smoke test for server template rendering (fonts + skia).
 * Usage: pnpm exec tsx scripts/test-template-render.ts
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createStarterSceneDocument } from "../convex/automations/scenes";
import { renderTemplateToPng } from "../convex/automations/render/render_template_to_png";
import { DEFAULT_MOCK_MATCH } from "../lib/template-scene/mock-match";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
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
      loadTeamLogo: async () => null,
    },
  });

  if (png.byteLength < 1000) {
    throw new Error(`PNG too small (${png.byteLength} bytes)`);
  }

  const outputPath = path.join(__dirname, "../tmp/render-smoke-test.png");
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, png);
  console.log(`Wrote ${outputPath} (${png.byteLength} bytes)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
