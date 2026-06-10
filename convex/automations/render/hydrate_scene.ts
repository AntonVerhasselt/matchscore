"use node";

import Konva from "konva";
import { loadImage } from "skia-canvas";

import {
  getImageBindingKey,
  isFilledShapeClassName,
  prepareFilledShapeAttrsForRender,
  type AutomationType,
  type ImageBindingKey,
  type SceneDocument,
  type SceneNode,
  type SceneNodeAttrs,
} from "../../../lib/template-scene";
import {
  prepareImageLayout,
  prepareTextForRender,
  type PreparedTextRender,
} from "../../../lib/template-scene/prepare-render-node";
import type { MockMatchDto } from "../../../lib/template-scene/mock-match";
import { loadPlaceholderCrestImage } from "./load_placeholder_crest";

export type RenderAssetLoader = {
  loadAsset: (assetId: string) => Promise<Buffer | null>;
};

function stringAttr(attrs: SceneNodeAttrs, key: string): string | undefined {
  const value = attrs[key];
  return typeof value === "string" ? value : undefined;
}

function collectTextRenderByNodeId(
  node: SceneNode,
  automationType: AutomationType,
  match: MockMatchDto,
  map: Map<string, PreparedTextRender>,
): void {
  if (node.className === "Text") {
    const nodeId = stringAttr(node.attrs, "id");
    if (nodeId) {
      map.set(nodeId, prepareTextForRender(node.attrs, automationType, match));
    }
  }

  node.children?.forEach((child) =>
    collectTextRenderByNodeId(child, automationType, match, map),
  );
}

function prepareSceneNodeForRender(
  node: SceneNode,
  automationType: AutomationType,
  match: MockMatchDto,
): SceneNode {
  const children = node.children?.map((child) =>
    prepareSceneNodeForRender(child, automationType, match),
  );

  if (node.className === "Text") {
    const prepared = prepareTextForRender(node.attrs, automationType, match);
    return {
      className: node.className,
      attrs: {
        ...node.attrs,
        text: prepared.text,
        fontSize: prepared.fontSize,
      },
      ...(children ? { children } : {}),
    };
  }

  if (isFilledShapeClassName(node.className)) {
    return {
      className: node.className,
      attrs: prepareFilledShapeAttrsForRender(node.attrs),
      ...(children ? { children } : {}),
    };
  }

  return children ? { ...node, children } : node;
}

async function loadSceneImageSource(
  attrs: SceneNodeAttrs,
  loadAsset: (assetId: string) => Promise<Buffer | null>,
): Promise<Awaited<ReturnType<typeof loadImage>> | null> {
  const assetId = stringAttr(attrs, "assetId");
  if (assetId) {
    const buffer = await loadAsset(assetId);
    if (!buffer) {
      return null;
    }
    return await loadImage(buffer);
  }

  const bindingKey = getImageBindingKey(attrs.bindingKey);
  if (bindingKey) {
    return await loadPlaceholderCrestImage(bindingKey);
  }

  return null;
}

async function replaceImageNodeWithGroup(
  node: Konva.Image,
  attrs: SceneNodeAttrs,
  loadAsset: (assetId: string) => Promise<Buffer | null>,
): Promise<void> {
  const parent = node.getParent();
  if (!parent) {
    return;
  }

  const bitmap = await loadSceneImageSource(attrs, loadAsset);
  if (!bitmap) {
    return;
  }
  const naturalWidth = bitmap.width || 1;
  const naturalHeight = bitmap.height || 1;
  const boxWidth = node.width();
  const boxHeight = node.height();
  const fit = prepareImageLayout(
    {
      ...attrs,
      width: boxWidth,
      height: boxHeight,
    },
    naturalWidth,
    naturalHeight,
  );

  const group = new Konva.Group({
    x: node.x(),
    y: node.y(),
    width: boxWidth,
    height: boxHeight,
    clipX: 0,
    clipY: 0,
    clipWidth: boxWidth,
    clipHeight: boxHeight,
    id: node.id(),
    name: node.name(),
    visible: node.visible(),
    listening: false,
    rotation: node.rotation(),
    opacity: node.opacity(),
  });

  group.add(
    new Konva.Image({
      x: fit.render.x,
      y: fit.render.y,
      width: fit.render.width,
      height: fit.render.height,
      image: bitmap as unknown as HTMLImageElement,
      crop: fit.crop,
      listening: false,
    }),
  );

  const index = node.zIndex();
  node.destroy();
  parent.add(group);
  group.zIndex(index);
}

export async function hydrateKonvaStage(
  stage: Konva.Stage,
  sceneDocument: SceneDocument,
  automationType: AutomationType,
  match: MockMatchDto,
  loaders: RenderAssetLoader,
): Promise<void> {
  const textRenderById = new Map<string, PreparedTextRender>();
  collectTextRenderByNodeId(
    sceneDocument.stage,
    automationType,
    match,
    textRenderById,
  );

  stage.find("Text").forEach((node) => {
    const textNode = node as Konva.Text;
    const prepared = textRenderById.get(textNode.id());
    if (!prepared) {
      return;
    }

    textNode.wrap(prepared.wrap);
  });

  const imageNodes = stage.find("Image") as Konva.Image[];
  for (const imageNode of imageNodes) {
    const attrs: SceneNodeAttrs = {
      id: imageNode.id(),
      x: imageNode.x(),
      y: imageNode.y(),
      width: imageNode.width(),
      height: imageNode.height(),
      objectFit: imageNode.getAttr("objectFit"),
      assetId: imageNode.getAttr("assetId"),
      bindingKey: imageNode.getAttr("bindingKey"),
    };

    if (imageNode.visible() === false) {
      continue;
    }

    await replaceImageNodeWithGroup(imageNode, attrs, loaders.loadAsset);
  }

  stage.draw();
}

export function createPreparedStageJson(
  sceneDocument: SceneDocument,
  automationType: AutomationType,
  match: MockMatchDto,
): SceneDocument {
  return {
    schemaVersion: 1,
    stage: prepareSceneNodeForRender(sceneDocument.stage, automationType, match),
  };
}

export type { ImageBindingKey };
