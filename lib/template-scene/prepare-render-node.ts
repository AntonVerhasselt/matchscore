import {
  calculateObjectFit,
  calculateTextFit,
  displayText,
  getObjectFitMode,
  getTextBindingKey,
  getTextOverflowMode,
  type AutomationType,
  type ObjectFitResult,
  type SceneNodeAttrs,
} from "./index";
import {
  formatBinding,
  isTextBindingAllowedForAutomationType,
} from "./format-binding";
import type { MockMatchDto } from "./mock-match";
import { ellipsizeText, measureTextForFit } from "./text-measure";

export const BACKGROUND_NODE_ID = "background";

export type PreparedTextRender = {
  text: string;
  fontSize: number;
  wrap: "word" | "none";
};

function numberAttr(attrs: SceneNodeAttrs, key: string, fallback: number): number {
  const value = attrs[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function optionalNumberAttr(attrs: SceneNodeAttrs, key: string): number | undefined {
  const value = attrs[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function stringAttr(attrs: SceneNodeAttrs, key: string): string | undefined {
  const value = attrs[key];
  return typeof value === "string" ? value : undefined;
}

export function isBackgroundNodeAttrs(attrs: SceneNodeAttrs): boolean {
  return stringAttr(attrs, "id") === BACKGROUND_NODE_ID;
}

export function resolveBoundOrFixedText(
  attrs: SceneNodeAttrs,
  automationType: AutomationType,
  match: MockMatchDto,
): string {
  const bindingKey = getTextBindingKey(attrs.bindingKey, automationType);
  if (bindingKey && isTextBindingAllowedForAutomationType(bindingKey, automationType)) {
    return formatBinding(bindingKey, match, "nl-BE");
  }

  return displayText(stringAttr(attrs, "text") ?? "", attrs);
}

export function prepareTextForRender(
  attrs: SceneNodeAttrs,
  automationType: AutomationType,
  match: MockMatchDto,
): PreparedTextRender {
  const rawText = resolveBoundOrFixedText(attrs, automationType, match);
  const baseFontSize = numberAttr(attrs, "fontSize", 48);
  const fontFamily = stringAttr(attrs, "fontFamily") ?? "Arial";
  const overflowMode = getTextOverflowMode(attrs.overflowMode);
  const width = numberAttr(attrs, "width", 300);
  const height = optionalNumberAttr(attrs, "height");

  const fontSize =
    overflowMode === "shrink" && height
      ? calculateTextFit(
          rawText,
          fontFamily,
          width,
          height,
          baseFontSize,
          measureTextForFit,
        )
      : baseFontSize;

  const text =
    overflowMode === "ellipsis"
      ? ellipsizeText(rawText, width, fontSize)
      : rawText;

  const wrap =
    overflowMode === "fixed" || overflowMode === "ellipsis" ? "none" : "word";

  return { text, fontSize, wrap };
}

export function prepareImageLayout(
  attrs: SceneNodeAttrs,
  naturalWidth: number,
  naturalHeight: number,
): ObjectFitResult {
  const width = numberAttr(attrs, "width", 160);
  const height = numberAttr(attrs, "height", 160);
  const objectFit = getObjectFitMode(attrs.objectFit);

  if (isBackgroundNodeAttrs(attrs)) {
    return {
      crop: { x: 0, y: 0, width: naturalWidth, height: naturalHeight },
      render: { x: 0, y: 0, width, height },
    };
  }

  return calculateObjectFit(
    naturalWidth,
    naturalHeight,
    width,
    height,
    objectFit,
  );
}

export function applyPreparedTextToSceneNodeAttrs(
  attrs: SceneNodeAttrs,
  automationType: AutomationType,
  match: MockMatchDto,
): SceneNodeAttrs {
  const prepared = prepareTextForRender(attrs, automationType, match);
  return {
    ...attrs,
    text: prepared.text,
    fontSize: prepared.fontSize,
  };
}
