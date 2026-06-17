"use node";

import Konva from "konva";
import { loadImage } from "skia-canvas";

import {
  createPlaceholderCrestDataUrl,
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
import type { Id } from "../../_generated/dataModel";
import type { TemplateMatchDto } from "../../../lib/template-scene/template-match";

export type RenderAssetLoader = {
  loadAsset: (assetId: string) => Promise<Buffer | null>;
  loadTeamLogo: (storageId: Id<"_storage">) => Promise<Buffer | null>;
};

function stringAttr(attrs: SceneNodeAttrs, key: string): string | undefined {
  const value = attrs[key];
  return typeof value === "string" ? value : undefined;
}

function collectTextRenderByNodeId(
  node: SceneNode,
  automationType: AutomationType,
  match: TemplateMatchDto,
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
  match: TemplateMatchDto,
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

function logoStorageIdForBinding(
  bindingKey: ImageBindingKey,
  match: TemplateMatchDto,
): Id<"_storage"> | undefined {
  return bindingKey === "homeClubLogo"
    ? match.homeClub.logoStorageId
    : match.awayClub.logoStorageId;
}

async function loadSceneImageSource(
  attrs: SceneNodeAttrs,
  loaders: RenderAssetLoader,
  match: TemplateMatchDto,
): Promise<Awaited<ReturnType<typeof loadImage>> | null> {
  const assetId = stringAttr(attrs, "assetId");
  if (assetId) {
    const buffer = await loaders.loadAsset(assetId);
    if (!buffer) {
      return null;
    }
    return await loadImage(buffer);
  }

  const bindingKey = getImageBindingKey(attrs.bindingKey);
  if (bindingKey) {
    const storageId = logoStorageIdForBinding(bindingKey, match);
    if (storageId) {
      const buffer = await loaders.loadTeamLogo(storageId);
      if (buffer) {
        return await loadImage(buffer);
      }
    }

    return await loadImage(createPlaceholderCrestDataUrl(bindingKey, "preview"));
  }

  return null;
}

function createImageContainerGroup(
  node: Konva.Image,
  attrs: SceneNodeAttrs,
  boxWidth: number,
  boxHeight: number,
): Konva.Group {
  return new Konva.Group({
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
}

async function replaceImageNodeWithGroup(
  node: Konva.Image,
  attrs: SceneNodeAttrs,
  loaders: RenderAssetLoader,
  match: TemplateMatchDto,
): Promise<void> {
  const parent = node.getParent();
  if (!parent) {
    return;
  }

  const boxWidth = node.width();
  const boxHeight = node.height();
  const bindingKey = getImageBindingKey(attrs.bindingKey);
  const assetId = stringAttr(attrs, "assetId");
  const bitmap = await loadSceneImageSource(attrs, loaders, match);

  if (!bitmap) {
    if (!bindingKey && !assetId) {
      return;
    }

    const group = createImageContainerGroup(node, attrs, boxWidth, boxHeight);
    const index = node.zIndex();
    node.destroy();
    parent.add(group);
    group.zIndex(index);
    return;
  }

  const naturalWidth = bitmap.width || 1;
  const naturalHeight = bitmap.height || 1;
  const fit = prepareImageLayout(
    {
      ...attrs,
      width: boxWidth,
      height: boxHeight,
    },
    naturalWidth,
    naturalHeight,
  );

  const group = createImageContainerGroup(node, attrs, boxWidth, boxHeight);

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
  match: TemplateMatchDto,
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

    await replaceImageNodeWithGroup(imageNode, attrs, loaders, match);
  }

  stage.draw();
}

export function createPreparedStageJson(
  sceneDocument: SceneDocument,
  automationType: AutomationType,
  match: TemplateMatchDto,
): SceneDocument {
  return {
    schemaVersion: 1,
    stage: prepareSceneNodeForRender(sceneDocument.stage, automationType, match),
  };
}

export type { ImageBindingKey };
