"use client";

import {
  ArrowLeft,
  Circle,
  ImageIcon,
  Save,
  Shapes,
  SlidersHorizontal,
  Square,
  Type,
  UploadCloud,
} from "lucide-react";
import type Konva from "konva";
import Link from "next/link";
import { useTranslations } from "next-intl";
import useImage from "use-image";
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
  Image as KonvaImage,
  Layer,
  Rect,
  Stage,
  Text as KonvaText,
  Transformer,
} from "react-konva";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  getAvailableImageBindingKeys,
  getAvailableTextBindingKeys,
  getImageBindingKey,
  getTextBindingKey,
  normalizeSceneDocument,
  resolveImageSource,
  resolveTextContent,
  type AutomationType,
  type BindingPreviewMode,
  type ImageBindingKey,
  type SceneDocument,
  type SceneNode,
  type SceneNodeAttrs,
  type TextBindingKey,
} from "@/lib/template-scene";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  toBackendAutomationType,
  type AutomationTypeSlug,
  type CanvasPreset,
} from "@/lib/automations/types";
import { CANVAS_PRESET_LABELS } from "@/lib/automations/canvas-presets";
import { showErrorToast, showSuccessToast } from "@/lib/user-feedback";
import { useMutation } from "convex/react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const VARIABLE_DRAG_MIME = "application/x-matchscore-template-variable";

type EditorPanelTab = "variables" | "assets" | "text" | "shapes" | "properties";

type VariableDragPayload =
  | { kind: "text"; bindingKey: TextBindingKey }
  | { kind: "image"; bindingKey: ImageBindingKey };

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
  const backendAutomationType = toBackendAutomationType(automationType);
  const [templateName, setTemplateName] = useState(template.name);
  const [sceneDocument, setSceneDocument] = useState<SceneDocument | null>(() => {
    try {
      return normalizeSceneDocument(
        template.sceneDocument,
        template.canvasPreset,
        backendAutomationType,
      );
    } catch {
      return null;
    }
  });
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [previewMode, setPreviewMode] =
    useState<BindingPreviewMode>("design");
  const [activePanelTab, setActivePanelTab] =
    useState<EditorPanelTab>("variables");
  const [titleInputWidth, setTitleInputWidth] = useState(40);
  const nodeRefs = useRef(new Map<string, Konva.Node>());
  const transformerRef = useRef<Konva.Transformer>(null);
  const titleMeasureRef = useRef<HTMLSpanElement>(null);
  const stageFrameRef = useRef<HTMLDivElement>(null);
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

  const selectNode = useCallback((nodeId: string) => {
    setSelectedNodeId(nodeId);
    setActivePanelTab("properties");
  }, []);

  const handleVariableDragStart = useCallback(
    (event: React.DragEvent<HTMLElement>, payload: VariableDragPayload) => {
      event.dataTransfer.effectAllowed = "copy";
      event.dataTransfer.setData(VARIABLE_DRAG_MIME, JSON.stringify(payload));
    },
    [],
  );

  const handleCanvasDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      if (!sceneDocument || !stageFrameRef.current) {
        return;
      }

      const payload = parseVariableDragPayload(
        event.dataTransfer.getData(VARIABLE_DRAG_MIME),
      );
      if (!payload) {
        return;
      }

      const rect = stageFrameRef.current.getBoundingClientRect();
      const point = {
        x: Math.round((event.clientX - rect.left) / scale),
        y: Math.round((event.clientY - rect.top) / scale),
      };
      const nodeId = `${payload.bindingKey}-${Date.now()}`;
      const node =
        payload.kind === "image"
          ? createLogoNode(sceneDocument, nodeId, payload.bindingKey, point)
          : createTextBindingNode(nodeId, payload.bindingKey, point);

      setSceneDocument(appendSceneNodeToFirstLayer(sceneDocument, node));
      setSelectedNodeId(nodeId);
      setActivePanelTab("properties");
      setIsDirty(true);
    },
    [scale, sceneDocument],
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
        backendAutomationType,
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
            variant="outline"
            size="sm"
            onClick={() =>
              setPreviewMode((current) =>
                current === "design" ? "preview" : "design",
              )
            }
          >
            {previewMode === "design"
              ? t("editor.showPreviewMode")
              : t("editor.showDesignMode")}
          </Button>
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
            ref={stageFrameRef}
            className="overflow-hidden border bg-background shadow-sm"
            style={{
              width: stageDimensions.width * scale,
              height: stageDimensions.height * scale,
            }}
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleCanvasDrop}
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
                  automationType={backendAutomationType}
                  previewMode={previewMode}
                  onSelect={selectNode}
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

        <aside className="flex w-[23rem] shrink-0 border-l bg-background">
          <EditorRightPanel
            activeTab={activePanelTab}
            selectedNode={selectedNode}
            automationType={backendAutomationType}
            previewMode={previewMode}
            onTabChange={setActivePanelTab}
            onVariableDragStart={handleVariableDragStart}
            onPropertiesChange={updateSelectedNodeAttrs}
          />
        </aside>
      </div>
    </>
  );
}

function EditorRightPanel({
  activeTab,
  selectedNode,
  automationType,
  previewMode,
  onTabChange,
  onVariableDragStart,
  onPropertiesChange,
}: {
  activeTab: EditorPanelTab;
  selectedNode: SceneNode | null;
  automationType: AutomationType;
  previewMode: BindingPreviewMode;
  onTabChange: (tab: EditorPanelTab) => void;
  onVariableDragStart: (
    event: React.DragEvent<HTMLElement>,
    payload: VariableDragPayload,
  ) => void;
  onPropertiesChange: (attrs: SceneNodeAttrs) => void;
}) {
  const t = useTranslations("app.automations.editor");
  const tabs: Array<{
    id: EditorPanelTab;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { id: "variables", icon: SlidersHorizontal },
    { id: "assets", icon: UploadCloud },
    { id: "text", icon: Type },
    { id: "shapes", icon: Shapes },
    { id: "properties", icon: SlidersHorizontal },
  ];

  return (
    <>
      <div className="min-w-0 flex-1 overflow-y-auto p-4">
        {activeTab === "variables" ? (
          <VariablesPanel
            automationType={automationType}
            onVariableDragStart={onVariableDragStart}
          />
        ) : null}
        {activeTab === "assets" ? (
          <PlaceholderPanel
            title={t("assetsPanelTitle")}
            description={t("assetsPanelDescription")}
            icon={UploadCloud}
          />
        ) : null}
        {activeTab === "text" ? (
          <PlaceholderPanel
            title={t("textPanelTitle")}
            description={t("textPanelDescription")}
            icon={Type}
          />
        ) : null}
        {activeTab === "shapes" ? <ShapesPanel /> : null}
        {activeTab === "properties" ? (
          <PropertiesPanelShell
            selectedNode={selectedNode}
            automationType={automationType}
            previewMode={previewMode}
            onChange={onPropertiesChange}
          />
        ) : null}
      </div>
      <nav className="flex w-20 shrink-0 flex-col border-l bg-muted/30 py-2">
        {tabs.map(({ id, icon: Icon }) => (
          <button
            key={id}
            type="button"
            className={
              activeTab === id
                ? "flex flex-col items-center gap-1 border-r-2 border-primary bg-primary/10 px-2 py-3 text-[11px] font-semibold text-primary shadow-sm"
                : "flex flex-col items-center gap-1 border-r-2 border-transparent px-2 py-3 text-[11px] font-medium text-muted-foreground hover:bg-background/70 hover:text-foreground"
            }
            onClick={() => onTabChange(id)}
          >
            <Icon className="size-4" aria-hidden />
            {t(`panelTabs.${id}`)}
          </button>
        ))}
      </nav>
    </>
  );
}

function VariablesPanel({
  automationType,
  onVariableDragStart,
}: {
  automationType: AutomationType;
  onVariableDragStart: (
    event: React.DragEvent<HTMLElement>,
    payload: VariableDragPayload,
  ) => void;
}) {
  const t = useTranslations("app.automations.editor");

  return (
    <div className="space-y-6">
      <PanelHeader
        title={t("variablesPanelTitle")}
        description={t("variablesPanelDescription")}
      />

      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("textVariables")}
        </h3>
        <div className="grid gap-2">
          {getAvailableTextBindingKeys(automationType).map((bindingKey) => (
            <VariableCard
              key={bindingKey}
              title={t(`bindings.${bindingKey}`)}
              description={`{{ ${bindingKey} }}`}
              icon={Type}
              onDragStart={(event) =>
                onVariableDragStart(event, { kind: "text", bindingKey })
              }
            />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("logoVariables")}
        </h3>
        <div className="grid gap-2">
          {getAvailableImageBindingKeys().map((bindingKey) => (
            <VariableCard
              key={bindingKey}
              title={t(`bindings.${bindingKey}`)}
              description={t("dragLogoVariable")}
              icon={ImageIcon}
              onDragStart={(event) =>
                onVariableDragStart(event, { kind: "image", bindingKey })
              }
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function VariableCard({
  title,
  description,
  icon: Icon,
  onDragStart,
}: {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  onDragStart: (event: React.DragEvent<HTMLElement>) => void;
}) {
  return (
    <div
      draggable
      role="button"
      tabIndex={0}
      className="group flex cursor-grab items-center gap-3 border bg-card p-3 text-left shadow-sm transition-colors hover:border-primary/50 active:cursor-grabbing"
      onDragStart={onDragStart}
    >
      <div className="flex size-10 shrink-0 items-center justify-center bg-muted text-muted-foreground group-hover:text-foreground">
        <Icon className="size-4" aria-hidden />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{title}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {description}
        </p>
      </div>
    </div>
  );
}

function PropertiesPanelShell({
  selectedNode,
  automationType,
  previewMode,
  onChange,
}: {
  selectedNode: SceneNode | null;
  automationType: AutomationType;
  previewMode: BindingPreviewMode;
  onChange: (attrs: SceneNodeAttrs) => void;
}) {
  const t = useTranslations("app.automations.editor");

  if (!selectedNode) {
    return (
      <PlaceholderPanel
        title={t("propertiesPanelTitle")}
        description={t("propertiesPanelEmpty")}
        icon={SlidersHorizontal}
      />
    );
  }

  const textBindingKey =
    selectedNode.className === "Text"
      ? getTextBindingKey(selectedNode.attrs.bindingKey, automationType)
      : null;
  const imageBindingKey =
    selectedNode.className === "Image"
      ? getImageBindingKey(selectedNode.attrs.bindingKey)
      : null;
  const selectedLabel =
    (textBindingKey ? t(`bindings.${textBindingKey}`) : null) ??
    (imageBindingKey ? t(`bindings.${imageBindingKey}`) : null) ??
    stringAttr(selectedNode.attrs, "name") ??
    selectedNode.className;

  return (
    <div className="space-y-5">
      <div className="border bg-muted/30 p-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t("selectedItem")}
        </p>
        <h2 className="mt-1 text-base font-semibold">{selectedLabel}</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {t("selectedNode", { node: selectedNode.className })}
        </p>
      </div>
      <NodePropertiesPanel
        node={selectedNode}
        automationType={automationType}
        previewMode={previewMode}
        onChange={onChange}
      />
    </div>
  );
}

function ShapesPanel() {
  const t = useTranslations("app.automations.editor");
  return (
    <div className="space-y-5">
      <PanelHeader
        title={t("shapesPanelTitle")}
        description={t("shapesPanelDescription")}
      />
      <div className="grid grid-cols-2 gap-3">
        <ShapePreview icon={Square} label={t("shapeSquare")} />
        <ShapePreview icon={Circle} label={t("shapeCircle")} />
      </div>
    </div>
  );
}

function ShapePreview({
  icon: Icon,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <div className="flex h-24 flex-col items-center justify-center gap-2 border border-dashed bg-muted/30 text-muted-foreground">
      <Icon className="size-7" aria-hidden />
      <span className="text-xs font-medium">{label}</span>
    </div>
  );
}

function PlaceholderPanel({
  title,
  description,
  icon: Icon,
}: {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="space-y-5">
      <PanelHeader title={title} description={description} />
      <div className="flex min-h-40 flex-col items-center justify-center border border-dashed bg-muted/30 p-6 text-center text-muted-foreground">
        <Icon className="mb-3 size-8" aria-hidden />
        <p className="text-sm">{description}</p>
      </div>
    </div>
  );
}

function PanelHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

function SceneNodeRenderer({
  node,
  nodeRefs,
  automationType,
  previewMode,
  onSelect,
  onChange,
}: {
  node: SceneNode;
  nodeRefs: React.MutableRefObject<Map<string, Konva.Node>>;
  automationType: AutomationType;
  previewMode: BindingPreviewMode;
  onSelect: (nodeId: string) => void;
  onChange: (nodeId: string, attrs: SceneNodeAttrs) => void;
}) {
  const nodeId = stringAttr(node.attrs, "id");
  const children = node.children?.map((child) => (
    <SceneNodeRenderer
      key={nodeKey(child)}
      node={child}
      nodeRefs={nodeRefs}
      automationType={automationType}
      previewMode={previewMode}
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
        text={resolveTextContent(node.attrs, automationType, previewMode)}
        fontSize={numberAttr(node.attrs, "fontSize", 48)}
        fontFamily={stringAttr(node.attrs, "fontFamily") ?? "Arial"}
        fontStyle={stringAttr(node.attrs, "fontStyle") ?? "normal"}
        fill={stringAttr(node.attrs, "fill") ?? "#ffffff"}
        align={stringAttr(node.attrs, "align") ?? "left"}
      />
    );
  }

  if (node.className === "Image") {
    return (
      <SceneImage
        {...sharedProps}
        attrs={node.attrs}
        previewMode={previewMode}
      />
    );
  }

  return null;
}

function SceneImage({
  attrs,
  previewMode,
  ...sharedProps
}: {
  attrs: SceneNodeAttrs;
  previewMode: BindingPreviewMode;
  id?: string;
  ref?: (node: Konva.Node | null) => void;
  draggable?: boolean;
  onClick?: () => void;
  onTap?: () => void;
  onDragEnd?: (event: Konva.KonvaEventObject<DragEvent>) => void;
  onTransformEnd?: (event: Konva.KonvaEventObject<Event>) => void;
}) {
  const src = resolveImageSource(attrs, previewMode);
  const [image] = useImage(src ?? "", "anonymous");
  const x = numberAttr(attrs, "x", 0);
  const y = numberAttr(attrs, "y", 0);
  const width = numberAttr(attrs, "width", 160);
  const height = numberAttr(attrs, "height", 160);

  if (!src || !image) {
    return (
      <Rect
        {...sharedProps}
        x={x}
        y={y}
        width={width}
        height={height}
        fill="#e5e7eb"
      />
    );
  }

  return (
    <KonvaImage
      {...sharedProps}
      x={x}
      y={y}
      width={width}
      height={height}
      image={image}
    />
  );
}

function NodePropertiesPanel({
  node,
  automationType,
  previewMode,
  onChange,
}: {
  node: SceneNode;
  automationType: AutomationType;
  previewMode: BindingPreviewMode;
  onChange: (attrs: SceneNodeAttrs) => void;
}) {
  const t = useTranslations("app.automations.editor");
  const isText = node.className === "Text";
  const isImage = node.className === "Image";
  const supportsFill = node.className === "Rect" || node.className === "Text";
  const textBindingKey = isText
    ? getTextBindingKey(node.attrs.bindingKey, automationType)
    : null;
  const imageBindingKey = isImage ? getImageBindingKey(node.attrs.bindingKey) : null;
  const contentMode = textBindingKey ? "variable" : "fixed";

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
          <div className="space-y-3 border-t pt-4">
            <div>
              <h3 className="text-sm font-medium">{t("content")}</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("contentDescription")}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="text-content-mode">{t("contentMode")}</Label>
              <Select
                value={contentMode}
                onValueChange={(value) => {
                  if (value === "fixed") {
                    onChange({
                      bindingKey: undefined,
                      text: resolveTextContent(node.attrs, automationType, "design"),
                    });
                    return;
                  }

                  const nextBindingKey =
                    textBindingKey ?? getAvailableTextBindingKeys(automationType)[0];
                  onChange({
                    bindingKey: nextBindingKey,
                    text: undefined,
                  });
                }}
              >
                <SelectTrigger id="text-content-mode" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">{t("fixedText")}</SelectItem>
                  <SelectItem value="variable">{t("variable")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {textBindingKey ? (
              <div className="space-y-2">
                <Label htmlFor="text-binding-key">{t("variableBinding")}</Label>
                <Select
                  value={textBindingKey}
                  onValueChange={(value) =>
                    onChange({ bindingKey: value as TextBindingKey, text: undefined })
                  }
                >
                  <SelectTrigger id="text-binding-key" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {getAvailableTextBindingKeys(automationType).map((bindingKey) => (
                      <SelectItem key={bindingKey} value={bindingKey}>
                        {t(`bindings.${bindingKey}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {t("resolvedPreview", {
                    value: resolveTextContent(node.attrs, automationType, previewMode),
                  })}
                </p>
              </div>
            ) : null}
          </div>
          {!textBindingKey ? (
            <div className="space-y-2">
              <Label htmlFor="node-text">{t("text")}</Label>
              <Input
                id="node-text"
                value={stringAttr(node.attrs, "text") ?? ""}
                onChange={(event) => onChange({ text: event.target.value })}
              />
            </div>
          ) : null}
          <NumberField
            label={t("fontSize")}
            value={numberAttr(node.attrs, "fontSize", 48)}
            min={1}
            onChange={(value) => onChange({ fontSize: value })}
          />
        </>
      ) : null}

      {isImage && imageBindingKey ? (
        <div className="space-y-3 border-t pt-4">
          <div>
            <h3 className="text-sm font-medium">{t("content")}</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("imageContentDescription")}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="image-binding-key">{t("variableBinding")}</Label>
            <Select
              value={imageBindingKey}
              onValueChange={(value) =>
                onChange({
                  bindingKey: value as ImageBindingKey,
                  assetId: undefined,
                })
              }
            >
              <SelectTrigger id="image-binding-key" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {getAvailableImageBindingKeys().map((bindingKey) => (
                  <SelectItem key={bindingKey} value={bindingKey}>
                    {t(`bindings.${bindingKey}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
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
      ? { ...node, attrs: mergeSceneNodeAttrs(node.attrs, attrs) }
      : node;

  if (!node.children) {
    return nextNode;
  }

  return {
    ...nextNode,
    children: node.children.map((child) => updateNodeAttrs(child, nodeId, attrs)),
  };
}

function mergeSceneNodeAttrs(
  currentAttrs: SceneNodeAttrs,
  nextAttrs: SceneNodeAttrs,
): SceneNodeAttrs {
  const merged = { ...currentAttrs };
  for (const [key, value] of Object.entries(nextAttrs)) {
    if (value === undefined) {
      delete merged[key];
    } else {
      merged[key] = value;
    }
  }
  return merged;
}

function appendSceneNodeToFirstLayer(
  sceneDocument: SceneDocument,
  nodeToAppend: SceneNode,
): SceneDocument {
  let hasAppended = false;
  const children = sceneDocument.stage.children?.map((child) => {
    if (!hasAppended && child.className === "Layer") {
      hasAppended = true;
      return {
        ...child,
        children: [...(child.children ?? []), nodeToAppend],
      };
    }
    return child;
  });

  if (hasAppended && children) {
    return {
      ...sceneDocument,
      stage: {
        ...sceneDocument.stage,
        children,
      },
    };
  }

  return {
    ...sceneDocument,
    stage: {
      ...sceneDocument.stage,
      children: [
        ...(sceneDocument.stage.children ?? []),
        { className: "Layer", attrs: {}, children: [nodeToAppend] },
      ],
    },
  };
}

function createTextBindingNode(
  nodeId: string,
  bindingKey: TextBindingKey,
  point: { x: number; y: number },
): SceneNode {
  const fontSize = 52;
  const token = `{{ ${bindingKey} }}`;

  return {
    className: "Text",
    attrs: {
      id: nodeId,
      name: bindingKey,
      x: point.x,
      y: point.y,
      width: estimateSingleLineTextWidth(token, fontSize),
      fontSize,
      fontFamily: "Arial",
      fill: "#ffffff",
      bindingKey,
    },
  };
}

function estimateSingleLineTextWidth(text: string, fontSize: number): number {
  return Math.ceil(text.length * fontSize * 0.62 + fontSize);
}

function createLogoNode(
  sceneDocument: SceneDocument,
  nodeId: string,
  bindingKey: ImageBindingKey,
  point?: { x: number; y: number },
): SceneNode {
  const stageWidth = numberAttr(sceneDocument.stage.attrs, "width", 1080);
  const stageHeight = numberAttr(sceneDocument.stage.attrs, "height", 1080);
  const size = Math.round(Math.min(stageWidth, stageHeight) * 0.16);
  const x = point ? point.x - Math.round(size / 2) : stageWidth / 2 - size / 2;
  const y = point ? point.y - Math.round(size / 2) : stageHeight / 2 - size / 2;

  return {
    className: "Image",
    attrs: {
      id: nodeId,
      name: bindingKey,
      x: Math.round(Math.max(0, Math.min(x, stageWidth - size))),
      y: Math.round(Math.max(0, Math.min(y, stageHeight - size))),
      width: size,
      height: size,
      bindingKey,
    },
  };
}

function parseVariableDragPayload(rawPayload: string): VariableDragPayload | null {
  if (!rawPayload) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawPayload) as Partial<VariableDragPayload>;
    if (
      parsed.kind === "text" &&
      typeof parsed.bindingKey === "string"
    ) {
      return {
        kind: "text",
        bindingKey: parsed.bindingKey as TextBindingKey,
      };
    }
    if (
      parsed.kind === "image" &&
      typeof parsed.bindingKey === "string"
    ) {
      return {
        kind: "image",
        bindingKey: parsed.bindingKey as ImageBindingKey,
      };
    }
  } catch {
    return null;
  }

  return null;
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
