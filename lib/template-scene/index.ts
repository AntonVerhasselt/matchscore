import {
  isValidKonvaFontStyle,
  isValidTextDecoration,
} from "./text-style";
import { createPlaceholderCrestDataUrl } from "./placeholder-crest";

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

export type ObjectFitMode = "cover" | "contain" | "fill";
export type TextOverflowMode = "wrap" | "shrink" | "ellipsis" | "fixed";
export type TextTransform = "none" | "uppercase";

export {
  buildKonvaFontStyle,
  getKonvaFontStyle,
  getTextDecoration,
  isUnderline,
  isValidKonvaFontStyle,
  isValidTextDecoration,
  parseKonvaFontStyle,
  toggleUnderline,
} from "./text-style";
export type { KonvaFontStyle } from "./text-style";

export {
  GOOGLE_FONT_CATALOG,
  TEMPLATE_FONT_OPTIONS,
  buildGoogleFontsStylesheetUrl,
  collectSceneFontFamilies,
  isGoogleFontFamily,
  isSystemFontFamily,
  loadGoogleFonts,
  searchTemplateFonts,
  shouldLoadGoogleFont,
} from "./google-fonts";
export type { FontSource, TemplateFontOption } from "./google-fonts";

export {
  createPlaceholderCrestDataUrl,
  createPlaceholderCrestSvg,
} from "./placeholder-crest";

export { DEFAULT_MOCK_MATCH, DEFAULT_MOCK_MATCH_KICKOFF_AT } from "./mock-match";
export type { MockMatchDto } from "./mock-match";

export {
  formatBinding,
  formatMatchDateTime,
  formatScore,
  isTextBindingAllowedForAutomationType,
} from "./format-binding";

export { ellipsizeText, measureTextForFit } from "./text-measure";

export {
  getFontFilesForFamilies,
  getGoogleCatalogFamilies,
} from "./server-font-registry";
export type { FontRegistrationEntry } from "./server-font-registry";

export type ObjectFitRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ObjectFitResult = {
  crop: ObjectFitRect;
  render: ObjectFitRect;
};

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
  "listening",
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
  "overlay",
  "overlayLayer",
  "editingText",
]);

const TEXT_OVERFLOW_MODES = new Set<TextOverflowMode>([
  "wrap",
  "shrink",
  "ellipsis",
  "fixed",
]);

const TEXT_TRANSFORMS = new Set<TextTransform>(["none", "uppercase"]);

const TEXT_ALIGNMENTS = new Set(["left", "center", "right", "justify"]);

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
    return displayText(stringAttr(attrs, "text") ?? "", attrs);
  }

  const resolved = previewMode === "preview"
    ? TEXT_BINDING_PREVIEW_VALUES[bindingKey]
    : TEXT_BINDING_DESIGN_VALUES[bindingKey];
  return displayText(resolved, attrs);
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

export function collectSceneAssetIds(rawSceneDocument: unknown): string[] {
  const assetIds = new Set<string>();
  collectAssetIdsFromUnknown(rawSceneDocument, assetIds);
  return [...assetIds];
}

export function getObjectFitMode(value: unknown): ObjectFitMode {
  return value === "contain" || value === "fill" ? value : "cover";
}

export function getTextOverflowMode(value: unknown): TextOverflowMode {
  return TEXT_OVERFLOW_MODES.has(value as TextOverflowMode)
    ? (value as TextOverflowMode)
    : "wrap";
}

export function getTextTransform(value: unknown): TextTransform {
  return TEXT_TRANSFORMS.has(value as TextTransform)
    ? (value as TextTransform)
    : "none";
}

export function displayText(text: string, attrs: SceneNodeAttrs): string {
  return getTextTransform(attrs.textTransform) === "uppercase"
    ? text.toUpperCase()
    : text;
}

export function calculateTextFit(
  text: string,
  fontFamily: string,
  maxWidth: number,
  maxHeight: number,
  baseFontSize: number,
  measure: (
    text: string,
    fontSize: number,
    fontFamily: string,
  ) => { width: number; height: number },
): number {
  if (typeof measure !== "function") {
    throw new TypeError("measure must be a function");
  }

  if (maxWidth <= 0 || maxHeight <= 0 || baseFontSize <= 0) {
    return 1;
  }

  let lo = 1;
  let hi = Math.max(Math.floor(baseFontSize), 1);
  let best = lo;

  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const measured = measure(text, mid, fontFamily);

    if (measured.width <= maxWidth && measured.height <= maxHeight) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  return best;
}

export function calculateObjectFit(
  sourceWidth: number,
  sourceHeight: number,
  destinationWidth: number,
  destinationHeight: number,
  mode: ObjectFitMode,
): ObjectFitResult {
  if (
    sourceWidth <= 0 ||
    sourceHeight <= 0 ||
    destinationWidth <= 0 ||
    destinationHeight <= 0
  ) {
    return {
      crop: { x: 0, y: 0, width: 1, height: 1 },
      render: { x: 0, y: 0, width: destinationWidth, height: destinationHeight },
    };
  }

  if (mode === "fill") {
    return {
      crop: { x: 0, y: 0, width: sourceWidth, height: sourceHeight },
      render: { x: 0, y: 0, width: destinationWidth, height: destinationHeight },
    };
  }

  if (mode === "contain") {
    const scale = Math.min(
      destinationWidth / sourceWidth,
      destinationHeight / sourceHeight,
    );
    const renderWidth = sourceWidth * scale;
    const renderHeight = sourceHeight * scale;

    return {
      crop: { x: 0, y: 0, width: sourceWidth, height: sourceHeight },
      render: {
        x: (destinationWidth - renderWidth) / 2,
        y: (destinationHeight - renderHeight) / 2,
        width: renderWidth,
        height: renderHeight,
      },
    };
  }

  const sourceRatio = sourceWidth / sourceHeight;
  const destinationRatio = destinationWidth / destinationHeight;

  if (sourceRatio > destinationRatio) {
    const cropWidth = sourceHeight * destinationRatio;
    return {
      crop: {
        x: (sourceWidth - cropWidth) / 2,
        y: 0,
        width: cropWidth,
        height: sourceHeight,
      },
      render: { x: 0, y: 0, width: destinationWidth, height: destinationHeight },
    };
  }

  const cropHeight = sourceWidth / destinationRatio;
  return {
    crop: {
      x: 0,
      y: (sourceHeight - cropHeight) / 2,
      width: sourceWidth,
      height: cropHeight,
    },
    render: { x: 0, y: 0, width: destinationWidth, height: destinationHeight },
  };
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
  validateCommonSceneNodeAttrs(attrs);

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
    validateTextSceneNodeAttrs(attrs);
    return;
  }

  if (className === "Image") {
    if (hasAssetId === hasBindingKey) {
      throw new Error("Image nodes require exactly one assetId or bindingKey");
    }
    if (hasBindingKey && !getImageBindingKey(attrs.bindingKey)) {
      throw new Error("Invalid image bindingKey");
    }
    if (
      attrs.objectFit !== undefined &&
      attrs.objectFit !== "cover" &&
      attrs.objectFit !== "contain" &&
      attrs.objectFit !== "fill"
    ) {
      throw new Error("Invalid image objectFit");
    }
    return;
  }

  if (attrs.overflowMode !== undefined) {
    throw new Error("overflowMode is only supported on Text nodes");
  }
  if (attrs.textTransform !== undefined) {
    throw new Error("textTransform is only supported on Text nodes");
  }
  if (hasAssetId) {
    throw new Error("assetId is only supported on Image nodes");
  }
  if (hasBindingKey) {
    throw new Error("bindingKey is only supported on Text and Image nodes");
  }
}

function validateCommonSceneNodeAttrs(attrs: SceneNodeAttrs) {
  if (attrs.name !== undefined && typeof attrs.name !== "string") {
    throw new Error("Scene node name must be a string");
  }
  if (attrs.visible !== undefined && typeof attrs.visible !== "boolean") {
    throw new Error("Scene node visible attr must be a boolean");
  }
  if (attrs.locked !== undefined && typeof attrs.locked !== "boolean") {
    throw new Error("Scene node locked attr must be a boolean");
  }
}

function validateTextSceneNodeAttrs(attrs: SceneNodeAttrs) {
  if (
    attrs.overflowMode !== undefined &&
    !TEXT_OVERFLOW_MODES.has(attrs.overflowMode as TextOverflowMode)
  ) {
    throw new Error("Invalid text overflowMode");
  }
  if (
    attrs.textTransform !== undefined &&
    !TEXT_TRANSFORMS.has(attrs.textTransform as TextTransform)
  ) {
    throw new Error("Invalid textTransform");
  }
  if (attrs.align !== undefined && !TEXT_ALIGNMENTS.has(attrs.align as string)) {
    throw new Error("Invalid text alignment");
  }
  if (
    attrs.lineHeight !== undefined &&
    (typeof attrs.lineHeight !== "number" ||
      !Number.isFinite(attrs.lineHeight) ||
      attrs.lineHeight <= 0)
  ) {
    throw new Error("Invalid text lineHeight");
  }
  if (attrs.fontFamily !== undefined && typeof attrs.fontFamily !== "string") {
    throw new Error("Invalid text fontFamily");
  }
  if (
    attrs.fontStyle !== undefined &&
    !isValidKonvaFontStyle(attrs.fontStyle)
  ) {
    throw new Error("Invalid text fontStyle");
  }
  if (
    attrs.textDecoration !== undefined &&
    !isValidTextDecoration(attrs.textDecoration)
  ) {
    throw new Error("Invalid text textDecoration");
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

function collectAssetIdsFromUnknown(value: unknown, assetIds: Set<string>) {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectAssetIdsFromUnknown(item, assetIds);
    }
    return;
  }

  if (!isPlainObject(value)) {
    return;
  }

  const assetId = value.assetId;
  if (typeof assetId === "string" && assetId.trim()) {
    assetIds.add(assetId);
  }

  for (const child of Object.values(value)) {
    collectAssetIdsFromUnknown(child, assetIds);
  }
}

function stringAttr(attrs: SceneNodeAttrs, key: string): string | undefined {
  const value = attrs[key];
  return typeof value === "string" ? value : undefined;
}
