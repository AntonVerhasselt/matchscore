"use client";

import type Konva from "konva";
import { useCallback, useRef } from "react";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  captureStageThumbnail,
  countRenderableSceneImages,
  dataUrlToBlob,
  hashTemplateThumbnailContent,
  THUMBNAIL_MIN_BLOB_BYTES,
  uploadTemplateThumbnailBlob,
  waitForStageImages,
} from "@/lib/template-scene/thumbnail-capture";
import type { SceneDocument } from "@/lib/template-scene";
import { useMutation } from "convex/react";

type UseTemplateThumbnailCaptureOptions = {
  enabled?: boolean;
  templateId: Id<"automationTemplates">;
  captureStageRef: React.RefObject<Konva.Stage | null>;
  prepareStageForCapture?: () => Promise<(() => void) | void>;
};

/**
 * Captures a list thumbnail after each successful save by cloning the editor
 * stage (preview mode, 1:1 scale, clipped canvas, no selection UI).
 * Runs client-side only; upload is best-effort and does not block the save flow.
 */
export function useTemplateThumbnailCapture({
  enabled = true,
  templateId,
  captureStageRef,
  prepareStageForCapture,
}: UseTemplateThumbnailCaptureOptions) {
  const generateUploadUrl = useMutation(
    api.templateAssets.mutations.generateUploadUrl,
  );
  const saveTemplateThumbnail = useMutation(
    api.automations.mutations.saveTemplateThumbnail,
  );

  const lastUploadedHashRef = useRef<string | null>(null);
  const isCapturingRef = useRef(false);

  const captureAfterSave = useCallback(
    async (
      templateName: string,
      normalizedSceneDocument: SceneDocument,
    ) => {
      if (!enabled || isCapturingRef.current) {
        return;
      }

      const stage = captureStageRef.current;
      if (!stage) {
        return;
      }

      isCapturingRef.current = true;
      let restoreCaptureState: (() => void) | undefined;

      try {
        const contentHash = await hashTemplateThumbnailContent(
          templateName,
          normalizedSceneDocument,
        );

        if (contentHash === lastUploadedHashRef.current) {
          return;
        }

        const maybeRestore = await prepareStageForCapture?.();
        restoreCaptureState =
          typeof maybeRestore === "function" ? maybeRestore : undefined;

        // Let React commit preview/selection changes before cloning the stage.
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => resolve());
          });
        });

        await waitForStageImages(stage, {
          minImageCount: countRenderableSceneImages(normalizedSceneDocument),
        });

        const dataUrl = captureStageThumbnail(stage);
        const blob = dataUrlToBlob(dataUrl);

        if (blob.size < THUMBNAIL_MIN_BLOB_BYTES) {
          console.error(
            "Template thumbnail capture produced an empty image; skipping upload.",
          );
          return;
        }

        await uploadTemplateThumbnailBlob({
          templateId,
          blob,
          generateUploadUrl: () => generateUploadUrl({}),
          saveTemplateThumbnail: (args) => saveTemplateThumbnail(args),
        });

        lastUploadedHashRef.current = contentHash;
      } catch (error) {
        console.error("Template thumbnail capture failed:", error);
      } finally {
        restoreCaptureState?.();
        isCapturingRef.current = false;
      }
    },
    [
      captureStageRef,
      enabled,
      generateUploadUrl,
      prepareStageForCapture,
      saveTemplateThumbnail,
      templateId,
    ],
  );

  return { captureAfterSave };
}
