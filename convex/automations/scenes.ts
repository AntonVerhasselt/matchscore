import type { CanvasPreset } from "./constants";
import { CANVAS_PRESET_DIMENSIONS } from "./constants";

export type SceneNodeClassName = "Stage" | "Layer" | "Group" | "Rect" | "Text";

export type SceneNodeAttrs = Record<string, unknown>;

export type SceneNode = {
  className: SceneNodeClassName;
  attrs: SceneNodeAttrs;
  children?: SceneNode[];
};

export type SceneDocument = {
  schemaVersion: 1;
  stage: SceneNode;
};

const ALLOWED_NODE_CLASSES = new Set<SceneNodeClassName>([
  "Stage",
  "Layer",
  "Group",
  "Rect",
  "Text",
]);

const EDITOR_ONLY_ATTRS = new Set([
  "draggable",
  "isDragging",
  "isSelected",
  "selected",
  "transformer",
  "transformerEnabled",
  "guide",
  "guideId",
  "isGuide",
  "temporary",
  "temporaryId",
  "ui",
  "selection",
]);

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
                fill: "#111827",
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
                fill: "#ffffff",
              },
            },
          ],
        },
      ],
    },
  };
}

export function normalizeSceneDocument(
  rawSceneDocument: unknown,
  canvasPreset: CanvasPreset,
): SceneDocument {
  const sceneDocument = parseSceneDocument(rawSceneDocument);
  const dimensions = CANVAS_PRESET_DIMENSIONS[canvasPreset];

  if (sceneDocument.schemaVersion !== 1) {
    throw new Error("Unsupported scene document schema version");
  }

  const stage = normalizeSceneNode(sceneDocument.stage);
  if (stage.className !== "Stage") {
    throw new Error("Scene document root must be a Stage");
  }

  if (
    stage.attrs.width !== dimensions.width ||
    stage.attrs.height !== dimensions.height
  ) {
    throw new Error("Scene document dimensions do not match canvas preset");
  }

  return {
    schemaVersion: 1,
    stage: {
      ...stage,
      attrs: {
        ...stage.attrs,
        width: dimensions.width,
        height: dimensions.height,
      },
    },
  };
}

export function validateSceneDocument(
  rawSceneDocument: unknown,
  canvasPreset: CanvasPreset,
): SceneDocument {
  return normalizeSceneDocument(rawSceneDocument, canvasPreset);
}

function parseSceneDocument(rawSceneDocument: unknown): {
  schemaVersion?: unknown;
  stage?: unknown;
} {
  if (typeof rawSceneDocument === "string") {
    try {
      const parsed = JSON.parse(rawSceneDocument) as unknown;
      return parseSceneDocument(parsed);
    } catch {
      throw new Error("Scene document must be valid JSON");
    }
  }

  if (!isPlainObject(rawSceneDocument)) {
    throw new Error("Scene document must be an object");
  }

  return rawSceneDocument;
}

function normalizeSceneNode(rawNode: unknown): SceneNode {
  if (!isPlainObject(rawNode)) {
    throw new Error("Scene node must be an object");
  }

  const className = rawNode.className;
  if (!isAllowedClassName(className)) {
    throw new Error("Unsupported scene node class");
  }

  const rawAttrs = rawNode.attrs;
  if (!isPlainObject(rawAttrs)) {
    throw new Error("Scene node attrs must be an object");
  }

  const attrs = normalizeSceneNodeAttrs(rawAttrs);
  const rawChildren = rawNode.children;
  const children = Array.isArray(rawChildren)
    ? rawChildren.map((child) => normalizeSceneNode(child))
    : undefined;

  return children
    ? { className, attrs, children }
    : { className, attrs };
}

function normalizeSceneNodeAttrs(rawAttrs: Record<string, unknown>): SceneNodeAttrs {
  if ("filters" in rawAttrs || "sceneFunc" in rawAttrs) {
    throw new Error("Unsupported scene node attrs");
  }

  const attrs: SceneNodeAttrs = {};
  for (const [key, value] of Object.entries(rawAttrs)) {
    if (EDITOR_ONLY_ATTRS.has(key) || key === "scaleX" || key === "scaleY") {
      continue;
    }

    if (typeof value === "function" || typeof value === "symbol") {
      throw new Error("Unsupported scene node attr value");
    }

    attrs[key] = value;
  }

  const scaleX = asFiniteNumber(rawAttrs.scaleX) ?? 1;
  const scaleY = asFiniteNumber(rawAttrs.scaleY) ?? 1;
  const width = asFiniteNumber(rawAttrs.width);
  const height = asFiniteNumber(rawAttrs.height);

  if (width !== undefined && scaleX !== 1) {
    attrs.width = Math.max(Math.round(width * scaleX), 1);
  }
  if (height !== undefined && scaleY !== 1) {
    attrs.height = Math.max(Math.round(height * scaleY), 1);
  }

  return attrs;
}

function isAllowedClassName(value: unknown): value is SceneNodeClassName {
  return typeof value === "string" && ALLOWED_NODE_CLASSES.has(value as SceneNodeClassName);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype ||
      Object.getPrototypeOf(value) === null)
  );
}

function asFiniteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
