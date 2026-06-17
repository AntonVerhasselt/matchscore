"use node";

import Konva from "konva";
import "konva/skia-backend";
import { Canvas, loadImage } from "skia-canvas";

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
  /** Included in Convex logs to distinguish render test vs thumbnail jobs. */
  purpose?: string;
};

function exportStageToPngBuffer(stage: Konva.Stage): Buffer {
  const dataUrl = stage.toDataURL({ mimeType: "image/png" });
  const base64 = dataUrl.replace(/^data:image\/png;base64,/, "");
  return Buffer.from(base64, "base64");
}

async function exportStageToJpegThumbnailBuffer(
  stage: Konva.Stage,
  maxEdgePx: number,
  quality: number,
): Promise<Buffer> {
  // Export via PNG first — Konva's direct JPEG + pixelRatio export on the skia
  // backend can drop image layers (transparent areas become black in JPEG).
  const pngBuffer = exportStageToPngBuffer(stage);
  return await resizePngBufferToJpeg(pngBuffer, maxEdgePx, quality);
}

async function resizePngBufferToJpeg(
  pngBuffer: Buffer,
  maxEdgePx: number,
  quality: number,
): Promise<Buffer> {
  const image = await loadImage(pngBuffer);
  const longestEdge = Math.max(image.width, image.height);
  const scale = maxEdgePx / longestEdge;
  const targetWidth = Math.max(1, Math.round(image.width * scale));
  const targetHeight = Math.max(1, Math.round(image.height * scale));

  const canvas = new Canvas(targetWidth, targetHeight);
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0, targetWidth, targetHeight);

  return canvas.toBuffer("jpeg", { quality });
}

async function buildRenderedStage(
  input: RenderTemplateInput,
): Promise<Konva.Stage> {
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
    { purpose: input.purpose },
  );

  return stage;
}

export async function renderTemplateToPng(
  input: RenderTemplateInput,
): Promise<Buffer> {
  const stage = await buildRenderedStage(input);
  return exportStageToPngBuffer(stage);
}

export async function renderTemplateToJpegThumbnail(
  input: RenderTemplateInput,
  options?: {
    maxEdgePx?: number;
    quality?: number;
  },
): Promise<Buffer> {
  const stage = await buildRenderedStage(input);
  return await exportStageToJpegThumbnailBuffer(
    stage,
    options?.maxEdgePx ?? 256,
    options?.quality ?? 0.85,
  );
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
