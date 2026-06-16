import type Konva from "konva";

import type { Id } from "@/convex/_generated/dataModel";
import type { SceneDocument, SceneNode } from "./index";

/** Longest edge of the exported list thumbnail in CSS pixels. */
export const THUMBNAIL_MAX_EDGE_PX = 256;

/** JPEG quality for list thumbnails (balance size vs clarity). */
export const THUMBNAIL_JPEG_QUALITY = 0.85;

/** Reject blank/tainted canvas exports before overwriting a stored thumbnail. */
export const THUMBNAIL_MIN_BLOB_BYTES = 3_000;
const DEFAULT_IMAGE_WAIT_TIMEOUT_MS = 8_000;
const IMAGE_WAIT_POLL_INTERVAL_MS = 50;

export function countRenderableSceneImages(sceneDocument: SceneDocument): number {
  let count = 0;

  function walk(node: SceneNode) {
    if (node.className === "Image") {
      count += 1;
    }
    node.children?.forEach(walk);
  }

  sceneDocument.stage.children?.forEach(walk);
  return count;
}

/** Image nodes rendered in the off-screen thumbnail stage (club logos are skipped). */
export function countThumbnailCaptureImages(sceneDocument: SceneDocument): number {
  let count = 0;

  function walk(node: SceneNode) {
    if (node.className === "Image") {
      const bindingKey = node.attrs.bindingKey;
      if (bindingKey !== "homeClubLogo" && bindingKey !== "awayClubLogo") {
        count += 1;
      }
    }
    node.children?.forEach(walk);
  }

  sceneDocument.stage.children?.forEach(walk);
  return count;
}

export async function hashTemplateThumbnailContent(
  templateName: string,
  sceneDocument: SceneDocument,
): Promise<string> {
  const payload = `${templateName.trim()}\n${JSON.stringify(sceneDocument)}`;
  const bytes = new TextEncoder().encode(payload);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)?.[1] ?? "image/jpeg";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mime });
}

function isLoadedHtmlImage(image: CanvasImageSource | undefined): image is HTMLImageElement {
  return (
    image instanceof HTMLImageElement &&
    image.complete &&
    image.naturalWidth > 0 &&
    image.naturalHeight > 0
  );
}

function countLoadedKonvaImages(stage: Konva.Stage): number {
  return stage.find("Image").filter((node) => {
    const konvaImage = node as Konva.Image;
    return isLoadedHtmlImage(konvaImage.image());
  }).length;
}

/** Waits for Konva Image nodes to finish loading before canvas export. */
export async function waitForStageImages(
  stage: Konva.Stage,
  options?: {
    minImageCount?: number;
    timeoutMs?: number;
  },
): Promise<void> {
  const minImageCount = options?.minImageCount ?? 0;
  const timeoutMs = options?.timeoutMs ?? DEFAULT_IMAGE_WAIT_TIMEOUT_MS;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    stage.draw();

    const konvaImageCount = stage.find("Image").length;
    const loadedCount = countLoadedKonvaImages(stage);

    if (konvaImageCount === 0) {
      if (minImageCount === 0) {
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => resolve());
          });
        });
        stage.draw();
        return;
      }
    } else if (loadedCount === konvaImageCount) {
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => resolve());
        });
      });
      stage.draw();
      return;
    }

    await new Promise<void>((resolve) => {
      setTimeout(resolve, IMAGE_WAIT_POLL_INTERVAL_MS);
    });
  }

  stage.draw();
}

function clipStageLayers(stage: Konva.Stage, stageWidth: number, stageHeight: number) {
  for (const layer of stage.getLayers()) {
    layer.clipX(0);
    layer.clipY(0);
    layer.clipWidth(stageWidth);
    layer.clipHeight(stageHeight);
  }
}

/** Drop the editor-only overlay layer (transformer, line handles). */
function removeEditorOverlayLayer(stage: Konva.Stage) {
  for (const layer of stage.getLayers()) {
    if (layer.find("Transformer").length > 0) {
      layer.destroy();
      return;
    }
  }
}

/** Export a 1:1 clipped snapshot without editor scale or selection UI. */
export function captureStageThumbnail(stage: Konva.Stage): string {
  const stageWidth = stage.width();
  const stageHeight = stage.height();
  const longestEdge = Math.max(stageWidth, stageHeight);
  const pixelRatio = THUMBNAIL_MAX_EDGE_PX / longestEdge;

  const exportStage = stage.clone();
  exportStage.scaleX(1);
  exportStage.scaleY(1);
  removeEditorOverlayLayer(exportStage);
  clipStageLayers(exportStage, stageWidth, stageHeight);
  exportStage.draw();

  const dataUrl = exportStage.toDataURL({
    x: 0,
    y: 0,
    width: stageWidth,
    height: stageHeight,
    pixelRatio,
    mimeType: "image/jpeg",
    quality: THUMBNAIL_JPEG_QUALITY,
  });

  exportStage.destroy();
  return dataUrl;
}

export async function uploadTemplateThumbnailBlob({
  templateId,
  blob,
  generateUploadUrl,
  saveTemplateThumbnail,
}: {
  templateId: Id<"automationTemplates">;
  blob: Blob;
  generateUploadUrl: () => Promise<string>;
  saveTemplateThumbnail: (args: {
    templateId: Id<"automationTemplates">;
    newStorageId: Id<"_storage">;
  }) => Promise<null>;
}): Promise<void> {
  const uploadUrl = await generateUploadUrl();
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": blob.type },
    body: blob,
    keepalive: true,
  });

  if (!response.ok) {
    throw new Error("Thumbnail upload failed");
  }

  const { storageId } = (await response.json()) as {
    storageId: Id<"_storage">;
  };

  await saveTemplateThumbnail({
    templateId,
    newStorageId: storageId,
  });
}
