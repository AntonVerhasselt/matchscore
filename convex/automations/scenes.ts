import type { CanvasPreset } from "./constants";
import { CANVAS_PRESET_DIMENSIONS } from "./constants";
import type { SceneDocument } from "../../lib/template-scene";

export function createStarterSceneDocument(
  canvasPreset: CanvasPreset,
): SceneDocument {
  const dimensions = CANVAS_PRESET_DIMENSIONS[canvasPreset];

  return {
    schemaVersion: 1,
    stage: {
      className: "Stage",
      attrs: { ...dimensions },
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
                width: dimensions.width,
                height: dimensions.height,
                fill: "#ffffff",
              },
            },
            {
              className: "Text",
              attrs: {
                id: "title",
                x: 80,
                y: 80,
                width: Math.max(dimensions.width - 160, 100),
                text: "Matchscore template",
                fontSize: 64,
                fill: "#111827",
              },
            },
          ],
        },
      ],
    },
  };
}
