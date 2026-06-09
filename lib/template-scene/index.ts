type CanvasPreset =
  | "instagram_square"
  | "instagram_portrait"
  | "facebook_landscape";

export type AutomationType = "match_announcement" | "match_result";

const CANVAS_PRESET_DIMENSIONS: Record<
  CanvasPreset,
  { width: number; height: number }
> = {
  instagram_square: { width: 1080, height: 1080 },
  instagram_portrait: { width: 1080, height: 1350 },
  facebook_landscape: { width: 1200, height: 630 },
};

export type SceneNodeClassName =
  | "Stage"
  | "Layer"
  | "Group"
  | "Rect"
  | "Text"
  | "Image";

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

export const TEXT_BINDING_KEYS = [
  "homeClubName",
  "awayClubName",
  "homeAwayClubNames",
  "matchAddress",
  "matchDateTime",
  "score",
] as const;

export type TextBindingKey = (typeof TEXT_BINDING_KEYS)[number];

export const IMAGE_BINDING_KEYS = ["homeClubLogo", "awayClubLogo"] as const;

export type ImageBindingKey = (typeof IMAGE_BINDING_KEYS)[number];

export type BindingPreviewMode = "design" | "preview";

const TEXT_BINDING_KEYS_BY_AUTOMATION_TYPE: Record<
  AutomationType,
  readonly TextBindingKey[]
> = {
  match_announcement: [
    "homeClubName",
    "awayClubName",
    "homeAwayClubNames",
    "matchAddress",
    "matchDateTime",
  ],
  match_result: [
    "homeClubName",
    "awayClubName",
    "homeAwayClubNames",
    "matchAddress",
    "matchDateTime",
    "score",
  ],
};

const TEXT_BINDING_DESIGN_VALUES: Record<TextBindingKey, string> = {
  homeClubName: "{{ homeClubName }}",
  awayClubName: "{{ awayClubName }}",
  homeAwayClubNames: "{{ homeClubName }} - {{ awayClubName }}",
  matchAddress: "{{ matchAddress }}",
  matchDateTime: "{{ matchDateTime }}",
  score: "{{ score }}",
};

const TEXT_BINDING_PREVIEW_VALUES: Record<TextBindingKey, string> = {
  homeClubName: "KFC Eendracht",
  awayClubName: "Sporting Zuid",
  homeAwayClubNames: "KFC Eendracht - Sporting Zuid",
  matchAddress: "Sportpark De Klavers, Veldstraat 12",
  matchDateTime: "za 15 mrt. 2025, 20:00",
  score: "2 - 1",
};

const ALLOWED_NODE_CLASSES = new Set<SceneNodeClassName>([
  "Stage",
  "Layer",
  "Group",
  "Rect",
  "Text",
  "Image",
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

export function normalizeSceneDocument(
  rawSceneDocument: unknown,
  canvasPreset: CanvasPreset,
  automationType: AutomationType,
): SceneDocument {
  const sceneDocument = parseSceneDocument(rawSceneDocument);
  const dimensions = CANVAS_PRESET_DIMENSIONS[canvasPreset];

  if (sceneDocument.schemaVersion !== 1) {
    throw new Error("Unsupported scene document schema version");
  }

  const stage = normalizeSceneNode(sceneDocument.stage, automationType);
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
    stage,
  };
}

export function validateSceneDocument(
  rawSceneDocument: unknown,
  canvasPreset: CanvasPreset,
  automationType: AutomationType,
): SceneDocument {
  return normalizeSceneDocument(rawSceneDocument, canvasPreset, automationType);
}

export function getAvailableTextBindingKeys(
  automationType: AutomationType,
): readonly TextBindingKey[] {
  return TEXT_BINDING_KEYS_BY_AUTOMATION_TYPE[automationType];
}

export function getAvailableImageBindingKeys(): readonly ImageBindingKey[] {
  return IMAGE_BINDING_KEYS;
}

export function getTextBindingKey(
  value: unknown,
  automationType: AutomationType,
): TextBindingKey | null {
  if (
    typeof value === "string" &&
    getAvailableTextBindingKeys(automationType).includes(value as TextBindingKey)
  ) {
    return value as TextBindingKey;
  }

  return null;
}

export function getImageBindingKey(value: unknown): ImageBindingKey | null {
  if (
    typeof value === "string" &&
    IMAGE_BINDING_KEYS.includes(value as ImageBindingKey)
  ) {
    return value as ImageBindingKey;
  }

  return null;
}

export function resolveTextContent(
  attrs: SceneNodeAttrs,
  automationType: AutomationType,
  previewMode: BindingPreviewMode,
): string {
  const bindingKey = getTextBindingKey(attrs.bindingKey, automationType);
  if (!bindingKey) {
    return stringAttr(attrs, "text") ?? "";
  }

  return previewMode === "preview"
    ? TEXT_BINDING_PREVIEW_VALUES[bindingKey]
    : TEXT_BINDING_DESIGN_VALUES[bindingKey];
}

export function resolveImageSource(
  attrs: SceneNodeAttrs,
  previewMode: BindingPreviewMode,
): string | null {
  const bindingKey = getImageBindingKey(attrs.bindingKey);
  if (!bindingKey) {
    return null;
  }

  return createPlaceholderCrestDataUrl(bindingKey, previewMode);
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

function normalizeSceneNode(
  rawNode: unknown,
  automationType: AutomationType,
): SceneNode {
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

  const attrs = normalizeSceneNodeAttrsForClass(
    className,
    normalizeSceneNodeAttrs(rawAttrs),
    automationType,
  );
  validateSceneNodeAttrs(className, attrs, automationType);

  const rawChildren = rawNode.children;
  const children = Array.isArray(rawChildren)
    ? rawChildren.map((child) => normalizeSceneNode(child, automationType))
    : undefined;

  return children
    ? { className, attrs, children }
    : { className, attrs };
}

function normalizeSceneNodeAttrs(
  rawAttrs: Record<string, unknown>,
): SceneNodeAttrs {
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

function normalizeSceneNodeAttrsForClass(
  className: SceneNodeClassName,
  attrs: SceneNodeAttrs,
  automationType: AutomationType,
): SceneNodeAttrs {
  if (className === "Text" && getTextBindingKey(attrs.bindingKey, automationType)) {
    const nextAttrs = { ...attrs };
    delete nextAttrs.text;
    return nextAttrs;
  }

  return attrs;
}

function validateSceneNodeAttrs(
  className: SceneNodeClassName,
  attrs: SceneNodeAttrs,
  automationType: AutomationType,
) {
  const hasAssetId = isNonEmptyString(attrs.assetId);
  const hasBindingKey = isNonEmptyString(attrs.bindingKey);

  if (className === "Text") {
    if (hasAssetId) {
      throw new Error("assetId is only supported on Image nodes");
    }
    if (
      hasBindingKey &&
      !getAvailableTextBindingKeys(automationType).includes(
        attrs.bindingKey as TextBindingKey,
      )
    ) {
      throw new Error("Invalid text bindingKey for automation type");
    }
    return;
  }

  if (className === "Image") {
    if (hasAssetId === hasBindingKey) {
      throw new Error("Image nodes require exactly one assetId or bindingKey");
    }
    if (hasBindingKey && !getImageBindingKey(attrs.bindingKey)) {
      throw new Error("Invalid image bindingKey");
    }
    return;
  }

  if (hasAssetId) {
    throw new Error("assetId is only supported on Image nodes");
  }
  if (hasBindingKey) {
    throw new Error("bindingKey is only supported on Text and Image nodes");
  }
}

function isAllowedClassName(value: unknown): value is SceneNodeClassName {
  return (
    typeof value === "string" &&
    ALLOWED_NODE_CLASSES.has(value as SceneNodeClassName)
  );
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

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function stringAttr(attrs: SceneNodeAttrs, key: string): string | undefined {
  const value = attrs[key];
  return typeof value === "string" ? value : undefined;
}

function createPlaceholderCrestDataUrl(
  bindingKey: ImageBindingKey,
  previewMode: BindingPreviewMode,
): string {
  const isHome = bindingKey === "homeClubLogo";
  const primary = isHome
    ? previewMode === "preview"
      ? "#2563eb"
      : "#1d4ed8"
    : previewMode === "preview"
      ? "#dc2626"
      : "#b91c1c";
  const secondary = isHome ? "#dbeafe" : "#fee2e2";
  const label = isHome ? "HOME" : "AWAY";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240"><rect width="240" height="240" fill="${secondary}"/><path d="M120 20 198 52v62c0 52-32 91-78 106-46-15-78-54-78-106V52l78-32Z" fill="${primary}"/><path d="M120 48 172 70v42c0 36-20 62-52 76-32-14-52-40-52-76V70l52-22Z" fill="#fff" fill-opacity=".92"/><text x="120" y="132" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="700" fill="${primary}">${label}</text></svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
