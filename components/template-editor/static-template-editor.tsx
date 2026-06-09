"use client";

import { ArrowLeft, Save } from "lucide-react";
import type Konva from "konva";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Group,
  Layer,
  Rect,
  Stage,
  Text as KonvaText,
  Transformer,
} from "react-konva";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  normalizeSceneDocument,
  type SceneDocument,
  type SceneNode,
  type SceneNodeAttrs,
} from "@/lib/template-scene";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AutomationTypeSlug, CanvasPreset } from "@/lib/automations/types";
import { CANVAS_PRESET_LABELS } from "@/lib/automations/canvas-presets";
import { showErrorToast, showSuccessToast } from "@/lib/user-feedback";
import { useMutation } from "convex/react";

type TemplateEditorTemplate = {
  _id: Id<"automationTemplates">;
  name: string;
  canvasPreset: CanvasPreset;
  sceneDocument: unknown;
};

type StaticTemplateEditorProps = {
  template: TemplateEditorTemplate;
  automationType: AutomationTypeSlug;
  backHref: string;
};

export function StaticTemplateEditor({
  template,
  automationType,
  backHref,
}: StaticTemplateEditorProps) {
  const t = useTranslations("app.automations");
  const updateTemplate = useMutation(api.automations.mutations.updateTemplate);
  const [templateName, setTemplateName] = useState(template.name);
  const [sceneDocument, setSceneDocument] = useState<SceneDocument | null>(() => {
    try {
      return normalizeSceneDocument(template.sceneDocument, template.canvasPreset);
    } catch {
      return null;
    }
  });
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [titleInputWidth, setTitleInputWidth] = useState(40);
  const nodeRefs = useRef(new Map<string, Konva.Node>());
  const transformerRef = useRef<Konva.Transformer>(null);
  const titleMeasureRef = useRef<HTMLSpanElement>(null);
  const stageDimensions = sceneDocument
    ? {
        width: numberAttr(sceneDocument.stage.attrs, "width", 1080),
        height: numberAttr(sceneDocument.stage.attrs, "height", 1080),
      }
    : { width: 1080, height: 1080 };
  const { containerRef, scale } = useStageScale(
    stageDimensions.width,
    stageDimensions.height,
  );
  const selectedNode = useMemo(
    () =>
      sceneDocument && selectedNodeId
        ? findSceneNodeById(sceneDocument.stage, selectedNodeId)
        : null,
    [sceneDocument, selectedNodeId],
  );

  useEffect(() => {
    const transformer = transformerRef.current;
    if (!transformer) {
      return;
    }

    const selectedKonvaNode = selectedNodeId
      ? nodeRefs.current.get(selectedNodeId)
      : null;
    transformer.nodes(selectedKonvaNode ? [selectedKonvaNode] : []);
    transformer.getLayer()?.batchDraw();
  }, [sceneDocument, selectedNodeId]);

  useLayoutEffect(() => {
    const measuredWidth = titleMeasureRef.current?.offsetWidth ?? 0;
    setTitleInputWidth(Math.max(Math.ceil(measuredWidth) + 10, 40));
  }, [templateName]);

  const updateSceneAttrs = useCallback(
    (nodeId: string, attrs: SceneNodeAttrs) => {
      setSceneDocument((current) =>
        current ? updateSceneNodeAttrs(current, nodeId, attrs) : current,
      );
      setIsDirty(true);
    },
    [],
  );

  const updateSelectedNodeAttrs = useCallback(
    (attrs: SceneNodeAttrs) => {
      if (!selectedNodeId) {
        return;
      }
      updateSceneAttrs(selectedNodeId, attrs);
    },
    [selectedNodeId, updateSceneAttrs],
  );

  const handleSave = async () => {
    if (!sceneDocument) {
      return;
    }

    setIsSaving(true);
    try {
      const normalizedSceneDocument = normalizeSceneDocument(
        sceneDocument,
        template.canvasPreset,
      );
      await updateTemplate({
        templateId: template._id,
        name: templateName,
        sceneDocument: normalizedSceneDocument,
      });
      setSceneDocument(normalizedSceneDocument);
      setIsDirty(false);
      showSuccessToast(t("editor.saveSuccess"));
    } catch {
      showErrorToast(t("editor.saveFailed"));
    } finally {
      setIsSaving(false);
    }
  };

  if (!sceneDocument) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-muted-foreground">{t("editor.notFound")}</p>
      </div>
    );
  }

  return (
    <>
      <header className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
        <Button
          variant="ghost"
          size="icon-sm"
          className="-ml-2"
          aria-label={t("backToTemplates")}
          asChild
        >
          <Link href={backHref}>
            <ArrowLeft aria-hidden />
          </Link>
        </Button>
        <div className="relative min-w-0 max-w-72">
          <span
            ref={titleMeasureRef}
            className="pointer-events-none invisible absolute whitespace-pre px-1 text-sm font-medium"
          >
            {templateName || " "}
          </span>
          <input
            aria-label={t("editor.templateName")}
            className="-ml-1 h-8 max-w-72 rounded-none border border-transparent bg-transparent px-1 text-sm font-medium outline-none transition-colors hover:border-border focus:border-ring focus:ring-3 focus:ring-ring/50"
            style={{ width: titleInputWidth }}
            value={templateName}
            onChange={(event) => {
              setTemplateName(event.target.value);
              setIsDirty(true);
            }}
          />
        </div>
        <Badge variant="outline">{t(`types.${automationType}.title`)}</Badge>
        <Badge variant="secondary">
          {CANVAS_PRESET_LABELS[template.canvasPreset]}
        </Badge>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            {isDirty ? t("editor.unsavedChanges") : t("editor.savedChanges")}
          </span>
          <Button
            type="button"
            size="sm"
            disabled={!isDirty || isSaving}
            onClick={() => void handleSave()}
          >
            <Save aria-hidden />
            {isSaving ? t("editor.saving") : t("editor.save")}
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <main
          ref={containerRef}
          className="flex min-w-0 flex-1 items-center justify-center overflow-hidden bg-muted/30 p-6"
        >
          <div
            className="overflow-hidden border bg-background shadow-sm"
            style={{
              width: stageDimensions.width * scale,
              height: stageDimensions.height * scale,
            }}
          >
            <Stage
              width={stageDimensions.width}
              height={stageDimensions.height}
              scaleX={scale}
              scaleY={scale}
              onMouseDown={(event) => {
                if (event.target === event.target.getStage()) {
                  setSelectedNodeId(null);
                }
              }}
              onTouchStart={(event) => {
                if (event.target === event.target.getStage()) {
                  setSelectedNodeId(null);
                }
              }}
            >
              {sceneDocument.stage.children?.map((node) => (
                <SceneNodeRenderer
                  key={nodeKey(node)}
                  node={node}
                  nodeRefs={nodeRefs}
                  onSelect={setSelectedNodeId}
                  onChange={updateSceneAttrs}
                />
              ))}
              <Layer>
                <Transformer
                  ref={transformerRef}
                  rotateEnabled={false}
                  ignoreStroke
                />
              </Layer>
            </Stage>
          </div>
        </main>

        <aside className="flex w-80 shrink-0 flex-col gap-5 overflow-y-auto border-l bg-background p-4">
          <section className="space-y-4">
            <div>
              <h2 className="text-sm font-semibold">
                {t("editor.properties")}
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {selectedNode
                  ? t("editor.selectedNode", { node: selectedNode.className })
                  : t("editor.noSelection")}
              </p>
            </div>

            {selectedNode ? (
              <NodePropertiesPanel
                node={selectedNode}
                onChange={updateSelectedNodeAttrs}
              />
            ) : null}
          </section>
        </aside>
      </div>
    </>
  );
}

function SceneNodeRenderer({
  node,
  nodeRefs,
  onSelect,
  onChange,
}: {
  node: SceneNode;
  nodeRefs: React.MutableRefObject<Map<string, Konva.Node>>;
  onSelect: (nodeId: string) => void;
  onChange: (nodeId: string, attrs: SceneNodeAttrs) => void;
}) {
  const nodeId = stringAttr(node.attrs, "id");
  const children = node.children?.map((child) => (
    <SceneNodeRenderer
      key={nodeKey(child)}
      node={child}
      nodeRefs={nodeRefs}
      onSelect={onSelect}
      onChange={onChange}
    />
  ));
  const sharedProps = nodeId
    ? {
        id: nodeId,
        ref: (konvaNode: Konva.Node | null) => {
          if (konvaNode) {
            nodeRefs.current.set(nodeId, konvaNode);
          } else {
            nodeRefs.current.delete(nodeId);
          }
        },
        draggable: true,
        onClick: () => onSelect(nodeId),
        onTap: () => onSelect(nodeId),
        onDragEnd: (event: Konva.KonvaEventObject<DragEvent>) => {
          onChange(nodeId, {
            x: Math.round(event.target.x()),
            y: Math.round(event.target.y()),
          });
        },
        onTransformEnd: (event: Konva.KonvaEventObject<Event>) => {
          onChange(nodeId, bakeNodeTransform(event.target));
        },
      }
    : {};

  if (node.className === "Layer") {
    return <Layer>{children}</Layer>;
  }

  if (node.className === "Group") {
    return (
      <Group
        {...sharedProps}
        x={numberAttr(node.attrs, "x", 0)}
        y={numberAttr(node.attrs, "y", 0)}
      >
        {children}
      </Group>
    );
  }

  if (node.className === "Rect") {
    return (
      <Rect
        {...sharedProps}
        x={numberAttr(node.attrs, "x", 0)}
        y={numberAttr(node.attrs, "y", 0)}
        width={numberAttr(node.attrs, "width", 100)}
        height={numberAttr(node.attrs, "height", 100)}
        fill={stringAttr(node.attrs, "fill") ?? "#111827"}
      />
    );
  }

  if (node.className === "Text") {
    return (
      <KonvaText
        {...sharedProps}
        x={numberAttr(node.attrs, "x", 0)}
        y={numberAttr(node.attrs, "y", 0)}
        width={numberAttr(node.attrs, "width", 300)}
        height={optionalNumberAttr(node.attrs, "height")}
        text={stringAttr(node.attrs, "text") ?? ""}
        fontSize={numberAttr(node.attrs, "fontSize", 48)}
        fontFamily={stringAttr(node.attrs, "fontFamily") ?? "Arial"}
        fontStyle={stringAttr(node.attrs, "fontStyle") ?? "normal"}
        fill={stringAttr(node.attrs, "fill") ?? "#ffffff"}
        align={stringAttr(node.attrs, "align") ?? "left"}
      />
    );
  }

  return null;
}

function NodePropertiesPanel({
  node,
  onChange,
}: {
  node: SceneNode;
  onChange: (attrs: SceneNodeAttrs) => void;
}) {
  const t = useTranslations("app.automations.editor");
  const isText = node.className === "Text";
  const supportsFill = node.className === "Rect" || node.className === "Text";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <NumberField
          label={t("width")}
          value={numberAttr(node.attrs, "width", 0)}
          min={1}
          onChange={(value) => onChange({ width: value })}
        />
        <NumberField
          label={t("height")}
          value={numberAttr(node.attrs, "height", 0)}
          min={0}
          onChange={(value) => onChange({ height: value })}
        />
      </div>

      {supportsFill ? (
        <div className="space-y-2">
          <Label htmlFor="node-fill">{t("fill")}</Label>
          <Input
            id="node-fill"
            type="color"
            value={stringAttr(node.attrs, "fill") ?? "#000000"}
            className="h-11 p-1"
            onChange={(event) => onChange({ fill: event.target.value })}
          />
        </div>
      ) : null}

      {isText ? (
        <>
          <div className="space-y-2">
            <Label htmlFor="node-text">{t("text")}</Label>
            <Input
              id="node-text"
              value={stringAttr(node.attrs, "text") ?? ""}
              onChange={(event) => onChange({ text: event.target.value })}
            />
          </div>
          <NumberField
            label={t("fontSize")}
            value={numberAttr(node.attrs, "fontSize", 48)}
            min={1}
            onChange={(value) => onChange({ fontSize: value })}
          />
        </>
      ) : null}
    </div>
  );
}

function NumberField({
  label,
  value,
  min,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  onChange: (value: number) => void;
}) {
  const id = `number-${label.toLowerCase().replace(/\s+/g, "-")}`;

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        min={min}
        value={Number.isFinite(value) ? value : 0}
        onChange={(event) => {
          const nextValue = Number(event.target.value);
          if (Number.isFinite(nextValue)) {
            onChange(nextValue);
          }
        }}
      />
    </div>
  );
}

function useStageScale(logicalWidth: number, logicalHeight: number) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return;
    }

    const resizeObserver = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      const nextScale = Math.min(
        width / logicalWidth,
        height / logicalHeight,
        1,
      );
      setScale(Math.max(nextScale, 0.1));
    });

    resizeObserver.observe(element);
    return () => resizeObserver.disconnect();
  }, [logicalHeight, logicalWidth]);

  return { containerRef, scale };
}

function findSceneNodeById(node: SceneNode, nodeId: string): SceneNode | null {
  if (stringAttr(node.attrs, "id") === nodeId) {
    return node;
  }

  for (const child of node.children ?? []) {
    const result = findSceneNodeById(child, nodeId);
    if (result) {
      return result;
    }
  }

  return null;
}

function updateSceneNodeAttrs(
  sceneDocument: SceneDocument,
  nodeId: string,
  attrs: SceneNodeAttrs,
): SceneDocument {
  return {
    ...sceneDocument,
    stage: updateNodeAttrs(sceneDocument.stage, nodeId, attrs),
  };
}

function updateNodeAttrs(
  node: SceneNode,
  nodeId: string,
  attrs: SceneNodeAttrs,
): SceneNode {
  const currentNodeId = stringAttr(node.attrs, "id");
  const nextNode =
    currentNodeId === nodeId
      ? { ...node, attrs: { ...node.attrs, ...attrs } }
      : node;

  if (!node.children) {
    return nextNode;
  }

  return {
    ...nextNode,
    children: node.children.map((child) => updateNodeAttrs(child, nodeId, attrs)),
  };
}

function bakeNodeTransform(node: Konva.Node): SceneNodeAttrs {
  const scaleX = node.scaleX();
  const scaleY = node.scaleY();
  const width = "width" in node ? node.width() : 0;
  const height = "height" in node ? node.height() : 0;

  // Scale is intentionally cleared because it is baked into width/height.
  node.scaleX(1);
  node.scaleY(1);

  return {
    x: Math.round(node.x()),
    y: Math.round(node.y()),
    width: Math.max(Math.round(width * scaleX), 1),
    height: Math.max(Math.round(height * scaleY), 1),
  };
}

function numberAttr(
  attrs: SceneNodeAttrs,
  key: string,
  fallback: number,
): number {
  return optionalNumberAttr(attrs, key) ?? fallback;
}

function optionalNumberAttr(
  attrs: SceneNodeAttrs,
  key: string,
): number | undefined {
  const value = attrs[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function stringAttr(attrs: SceneNodeAttrs, key: string): string | undefined {
  const value = attrs[key];
  return typeof value === "string" ? value : undefined;
}

function nodeKey(node: SceneNode): string {
  return stringAttr(node.attrs, "id") ?? `${node.className}-${JSON.stringify(node.attrs)}`;
}
