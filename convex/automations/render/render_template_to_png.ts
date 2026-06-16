"use node";

import Konva from "konva";
import "konva/skia-backend";

import {
  collectSceneFontFamilies,
  normalizeSceneDocument,
  type AutomationType,
  type SceneDocument,
} from "../../../lib/template-scene";
import type { TemplateMatchDto } from "../../../lib/template-scene/template-match";
import {
  createPreparedStageJson,
  hydrateKonvaStage,
  type RenderAssetLoader,
} from "./hydrate_scene";
import { registerSceneFonts } from "./register_scene_fonts";

export type RenderTemplateInput = {
  sceneDocument: unknown;
  automationType: AutomationType;
  canvasPreset: "instagram_square" | "instagram_portrait" | "facebook_landscape";
  match: TemplateMatchDto;
  loaders: RenderAssetLoader;
};

function exportStageToPngBuffer(stage: Konva.Stage): Buffer {
  const dataUrl = stage.toDataURL({ mimeType: "image/png" });
  const base64 = dataUrl.replace(/^data:image\/png;base64,/, "");
  return Buffer.from(base64, "base64");
}

export async function renderTemplateToPng(
  input: RenderTemplateInput,
): Promise<Buffer> {
  const sceneDocument = normalizeSceneDocument(
    input.sceneDocument,
    input.canvasPreset,
    input.automationType,
  );

  await registerSceneFonts(collectSceneFontFamilies(sceneDocument.stage));

  const preparedDocument = createPreparedStageJson(
    sceneDocument,
    input.automationType,
    input.match,
  );

  const stage = Konva.Node.create(preparedDocument.stage) as Konva.Stage;
  await hydrateKonvaStage(
    stage,
    sceneDocument,
    input.automationType,
    input.match,
    input.loaders,
  );

  return exportStageToPngBuffer(stage);
}

export async function renderSolidColorSpikePng(
  width: number,
  height: number,
  fill: string,
): Promise<Buffer> {
  const stage = new Konva.Stage({ width, height });
  const layer = new Konva.Layer();
  layer.add(
    new Konva.Rect({
      x: 0,
      y: 0,
      width,
      height,
      fill,
    }),
  );
  stage.add(layer);
  stage.draw();
  return exportStageToPngBuffer(stage);
}

export type { SceneDocument };
