import type { SceneNode, SceneNodeAttrs } from "./index";
// Type-only import — no runtime circular dependency.

export type ShapePresetId =
  | "rect-square"
  | "rect-rounded"
  | "rect-wide"
  | "circle"
  | "triangle"
  | "triangle-inverted"
  | "pentagon"
  | "hexagon"
  | "octagon"
  | "star-4"
  | "star-5"
  | "star-6"
  | "line-solid"
  | "line-dashed"
  | "line-dotted"
  | "arrow-right"
  | "arrow-both";

export type ShapeCategoryId = "basic" | "polygons" | "stars" | "lines";

export type ShapePresetDefinition = {
  id: ShapePresetId;
  category: ShapeCategoryId;
  /** i18n key under app.automations.editor.shapePresets */
  labelKey: string;
};

export const SHAPE_PRESET_DRAG_MIME =
  "application/x-matchscore-template-shape-preset";

export const SHAPE_CATEGORIES: Array<{
  id: ShapeCategoryId;
  labelKey: string;
  presets: ShapePresetDefinition[];
}> = [
  {
    id: "basic",
    labelKey: "shapeCategoryBasic",
    presets: [
      { id: "rect-square", category: "basic", labelKey: "rectSquare" },
      { id: "rect-rounded", category: "basic", labelKey: "rectRounded" },
      { id: "rect-wide", category: "basic", labelKey: "rectWide" },
      { id: "circle", category: "basic", labelKey: "circle" },
      { id: "triangle", category: "basic", labelKey: "triangle" },
      { id: "triangle-inverted", category: "basic", labelKey: "triangleInverted" },
    ],
  },
  {
    id: "polygons",
    labelKey: "shapeCategoryPolygons",
    presets: [
      { id: "pentagon", category: "polygons", labelKey: "pentagon" },
      { id: "hexagon", category: "polygons", labelKey: "hexagon" },
      { id: "octagon", category: "polygons", labelKey: "octagon" },
    ],
  },
  {
    id: "stars",
    labelKey: "shapeCategoryStars",
    presets: [
      { id: "star-4", category: "stars", labelKey: "star4" },
      { id: "star-5", category: "stars", labelKey: "star5" },
      { id: "star-6", category: "stars", labelKey: "star6" },
    ],
  },
  {
    id: "lines",
    labelKey: "shapeCategoryLines",
    presets: [
      { id: "line-solid", category: "lines", labelKey: "lineSolid" },
      { id: "line-dashed", category: "lines", labelKey: "lineDashed" },
      { id: "line-dotted", category: "lines", labelKey: "lineDotted" },
      { id: "arrow-right", category: "lines", labelKey: "arrowRight" },
      { id: "arrow-both", category: "lines", labelKey: "arrowBoth" },
    ],
  },
];

export const ALL_SHAPE_PRESET_IDS = SHAPE_CATEGORIES.flatMap((category) =>
  category.presets.map((preset) => preset.id),
);

export type ShapePresetDragPayload = {
  kind: "shape-preset";
  presetId: ShapePresetId;
};

export function isShapePresetId(value: unknown): value is ShapePresetId {
  return (
    typeof value === "string" &&
    (ALL_SHAPE_PRESET_IDS as readonly string[]).includes(value)
  );
}

export function parseShapePresetDragPayload(
  raw: string,
): ShapePresetDragPayload | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (
      !parsed ||
      typeof parsed !== "object" ||
      (parsed as ShapePresetDragPayload).kind !== "shape-preset" ||
      !isShapePresetId((parsed as ShapePresetDragPayload).presetId)
    ) {
      return null;
    }
    return parsed as ShapePresetDragPayload;
  } catch {
    return null;
  }
}

export function isVectorShapeClassName(
  className: string,
): className is "Line" | "Arrow" {
  return className === "Line" || className === "Arrow";
}

export function isRadiusShapeClassName(
  className: string,
): className is "Circle" | "RegularPolygon" | "Star" {
  return (
    className === "Circle" ||
    className === "RegularPolygon" ||
    className === "Star"
  );
}

function clampPoint(
  point: { x: number; y: number },
  stageWidth: number,
  stageHeight: number,
): { x: number; y: number } {
  return {
    x: Math.round(clamp(point.x, 0, stageWidth)),
    y: Math.round(clamp(point.y, 0, stageHeight)),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function baseShapeAttrs(
  nodeId: string,
  presetId: ShapePresetId,
  fill: string,
  stroke: string,
): SceneNodeAttrs {
  return {
    id: nodeId,
    name: presetId,
    fill,
    stroke,
  };
}

export function createShapeNode(
  presetId: ShapePresetId,
  nodeId: string,
  center: { x: number; y: number },
  options: {
    stageWidth: number;
    stageHeight: number;
    fill: string;
    stroke: string;
  },
): SceneNode {
  const point = clampPoint(center, options.stageWidth, options.stageHeight);
  const attrs = baseShapeAttrs(nodeId, presetId, options.fill, options.stroke);

  switch (presetId) {
    case "rect-square":
      return {
        className: "Rect",
        attrs: {
          ...attrs,
          x: point.x - 100,
          y: point.y - 100,
          width: 200,
          height: 200,
        },
      };
    case "rect-rounded":
      return {
        className: "Rect",
        attrs: {
          ...attrs,
          x: point.x - 110,
          y: point.y - 80,
          width: 220,
          height: 160,
          cornerRadius: 28,
        },
      };
    case "rect-wide":
      return {
        className: "Rect",
        attrs: {
          ...attrs,
          x: point.x - 180,
          y: point.y - 48,
          width: 360,
          height: 96,
        },
      };
    case "circle":
      return {
        className: "Circle",
        attrs: {
          ...attrs,
          x: point.x,
          y: point.y,
          radius: 100,
        },
      };
    case "triangle":
      return {
        className: "RegularPolygon",
        attrs: {
          ...attrs,
          x: point.x,
          y: point.y,
          sides: 3,
          radius: 110,
          rotation: -90,
        },
      };
    case "triangle-inverted":
      return {
        className: "RegularPolygon",
        attrs: {
          ...attrs,
          x: point.x,
          y: point.y,
          sides: 3,
          radius: 110,
          rotation: 90,
        },
      };
    case "pentagon":
      return {
        className: "RegularPolygon",
        attrs: {
          ...attrs,
          x: point.x,
          y: point.y,
          sides: 5,
          radius: 100,
          rotation: -90,
        },
      };
    case "hexagon":
      return {
        className: "RegularPolygon",
        attrs: {
          ...attrs,
          x: point.x,
          y: point.y,
          sides: 6,
          radius: 100,
          rotation: -90,
        },
      };
    case "octagon":
      return {
        className: "RegularPolygon",
        attrs: {
          ...attrs,
          x: point.x,
          y: point.y,
          sides: 8,
          radius: 100,
          rotation: -22.5,
        },
      };
    case "star-4":
      return {
        className: "Star",
        attrs: {
          ...attrs,
          x: point.x,
          y: point.y,
          numPoints: 4,
          innerRadius: 42,
          outerRadius: 100,
        },
      };
    case "star-5":
      return {
        className: "Star",
        attrs: {
          ...attrs,
          x: point.x,
          y: point.y,
          numPoints: 5,
          innerRadius: 40,
          outerRadius: 100,
          rotation: -90,
        },
      };
    case "star-6":
      return {
        className: "Star",
        attrs: {
          ...attrs,
          x: point.x,
          y: point.y,
          numPoints: 6,
          innerRadius: 42,
          outerRadius: 100,
          rotation: -90,
        },
      };
    case "line-solid":
      return {
        className: "Line",
        attrs: {
          ...attrs,
          x: point.x - 120,
          y: point.y,
          points: [0, 0, 240, 0],
          stroke: options.stroke,
          strokeWidth: 4,
          lineCap: "round",
        },
      };
    case "line-dashed":
      return {
        className: "Line",
        attrs: {
          ...attrs,
          x: point.x - 120,
          y: point.y,
          points: [0, 0, 240, 0],
          stroke: options.stroke,
          strokeWidth: 4,
          dash: [16, 10],
          lineCap: "round",
        },
      };
    case "line-dotted":
      return {
        className: "Line",
        attrs: {
          ...attrs,
          x: point.x - 120,
          y: point.y,
          points: [0, 0, 240, 0],
          stroke: options.stroke,
          strokeWidth: 6,
          dash: [2, 10],
          lineCap: "round",
        },
      };
    case "arrow-right":
      return {
        className: "Arrow",
        attrs: {
          ...attrs,
          x: point.x - 120,
          y: point.y,
          points: [0, 0, 220, 0],
          pointerLength: 18,
          pointerWidth: 18,
          fill: options.stroke,
          stroke: options.stroke,
          strokeWidth: 4,
          lineCap: "round",
          lineJoin: "round",
        },
      };
    case "arrow-both":
      return {
        className: "Arrow",
        attrs: {
          ...attrs,
          x: point.x - 120,
          y: point.y,
          points: [0, 0, 220, 0],
          pointerLength: 16,
          pointerWidth: 16,
          pointerAtBeginning: true,
          fill: options.stroke,
          stroke: options.stroke,
          strokeWidth: 4,
          lineCap: "round",
          lineJoin: "round",
        },
      };
  }
}
