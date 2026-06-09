"use client";

import {
  ArrowLeft,
  Circle,
  ImageIcon,
  Save,
  Shapes,
  SlidersHorizontal,
  Square,
  Palette,
  Trash2,
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
  getObjectFitMode,
  getTextBindingKey,
  calculateObjectFit,
  normalizeSceneDocument,
  resolveImageSource,
  resolveTextContent,
  type AutomationType,
  type BindingPreviewMode,
  type ImageBindingKey,
  type ObjectFitMode,
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
import { useMutation, useQuery } from "convex/react";
import {
  ALLOWED_TEMPLATE_ASSET_MIME_TYPES,
  MAX_TEMPLATE_ASSET_BYTE_SIZE,
} from "@/convex/templateAssets/constants";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const VARIABLE_DRAG_MIME = "application/x-matchscore-template-variable";
const ASSET_DRAG_MIME = "application/x-matchscore-template-asset";
const BACKGROUND_NODE_ID = "background";
const DEFAULT_BACKGROUND_FILL = "#ffffff";

type EditorPanelTab =
  | "variables"
  | "assets"
  | "text"
  | "shapes"
  | "background"
  | "properties";

type VariableDragPayload =
  | { kind: "text"; bindingKey: TextBindingKey }
  | { kind: "image"; bindingKey: ImageBindingKey };

type AssetDragPayload = { assetId: Id<"templateAssets"> };

type TemplateAsset = {
  _id: Id<"templateAssets">;
  storageId: Id<"_storage">;
  fileName: string;
  mimeType: string;
  byteSize: number;
  pixelWidth: number | null;
  pixelHeight: number | null;
  createdAt: number;
  url: string | null;
};

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
  const generateUploadUrl = useMutation(
    api.templateAssets.mutations.generateUploadUrl,
  );
  const saveTemplateAsset = useMutation(
    api.templateAssets.mutations.saveTemplateAsset,
  );
  const deleteTemplateAsset = useMutation(
    api.templateAssets.mutations.deleteTemplateAsset,
  );
  const templateAssets = useQuery(api.templateAssets.queries.listTemplateAssets);
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
  const [isUploadingAsset, setIsUploadingAsset] = useState(false);
  const [deletingAssetId, setDeletingAssetId] =
    useState<Id<"templateAssets"> | null>(null);
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
  const templateAssetRows = useMemo(() => templateAssets ?? [], [templateAssets]);
  const templateAssetsById = useMemo(
    () =>
      new Map<string, TemplateAsset>(
        templateAssetRows.map((asset) => [asset._id, asset]),
      ),
    [templateAssetRows],
  );
  const backgroundNode = useMemo(
    () => (sceneDocument ? findBackgroundNode(sceneDocument) : null),
    [sceneDocument],
  );

  useEffect(() => {
    const transformer = transformerRef.current;
    if (!transformer) {
      return;
    }

    const selectedKonvaNode =
      selectedNode &&
      isBackgroundNode(selectedNode) &&
      selectedNode.className !== "Image"
        ? null
        : selectedNodeId
          ? nodeRefs.current.get(selectedNodeId)
          : null;
    transformer.nodes(selectedKonvaNode ? [selectedKonvaNode] : []);
    transformer.getLayer()?.batchDraw();
  }, [sceneDocument, selectedNode, selectedNodeId]);

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

  const replaceSceneDocument = useCallback((nextSceneDocument: SceneDocument) => {
    setSceneDocument(nextSceneDocument);
    setIsDirty(true);
  }, []);

  const selectNode = useCallback(
    (nodeId: string) => {
      const node = sceneDocument
        ? findSceneNodeById(sceneDocument.stage, nodeId)
        : null;

      setSelectedNodeId(nodeId);
      setActivePanelTab(node && isBackgroundNode(node) ? "background" : "properties");
    },
    [sceneDocument],
  );

  const uploadTemplateAsset = useCallback(
    async (file: File): Promise<TemplateAsset> => {
      if (
        !ALLOWED_TEMPLATE_ASSET_MIME_TYPES.includes(
          file.type as (typeof ALLOWED_TEMPLATE_ASSET_MIME_TYPES)[number],
        )
      ) {
        throw new Error("Unsupported image type");
      }
      if (file.size > MAX_TEMPLATE_ASSET_BYTE_SIZE) {
        throw new Error("Image is too large");
      }

      const dimensions = await getImageFileDimensions(file);
      const uploadUrl = await generateUploadUrl({});
      const result = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!result.ok) {
        throw new Error("Upload failed");
      }

      const { storageId } = (await result.json()) as {
        storageId: Id<"_storage">;
      };

      return await saveTemplateAsset({
        storageId,
        fileName: file.name,
        pixelWidth: dimensions.width,
        pixelHeight: dimensions.height,
      });
    },
    [generateUploadUrl, saveTemplateAsset],
  );

  const handleUploadAsset = useCallback(
    async (file: File): Promise<TemplateAsset | null> => {
      setIsUploadingAsset(true);
      try {
        const asset = await uploadTemplateAsset(file);
        showSuccessToast(t("editor.assetUploadSuccess"));
        return asset;
      } catch {
        showErrorToast(t("editor.assetUploadFailed"));
        return null;
      } finally {
        setIsUploadingAsset(false);
      }
    },
    [t, uploadTemplateAsset],
  );

  const handleDeleteAsset = useCallback(
    async (assetId: Id<"templateAssets">) => {
      setDeletingAssetId(assetId);
      try {
        const result = await deleteTemplateAsset({ assetId });
        if (result.status === "inUse") {
          showErrorToast(t("editor.assetDeleteFailed"));
          return;
        }
        showSuccessToast(t("editor.assetDeleteSuccess"));
      } catch {
        showErrorToast(t("editor.assetDeleteFailed"));
      } finally {
        setDeletingAssetId(null);
      }
    },
    [deleteTemplateAsset, t],
  );

  const insertVariableNode = useCallback(
    (payload: VariableDragPayload, point: { x: number; y: number }) => {
      if (!sceneDocument) {
        return;
      }

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
    [sceneDocument],
  );

  const insertAssetNode = useCallback(
    async (asset: TemplateAsset, point?: { x: number; y: number }) => {
      if (!sceneDocument) {
        return;
      }

      let dimensions;
      try {
        dimensions = await getTemplateAssetDimensions(asset);
      } catch {
        showErrorToast(t("editor.assetInsertFailed"));
        return;
      }

      const nodeId = `asset-${asset._id}-${Date.now()}`;

      setSceneDocument((current) => {
        if (!current) {
          return current;
        }

        return appendSceneNodeToFirstLayer(
          current,
          createAssetImageNode(current, nodeId, asset, dimensions, point),
        );
      });
      setSelectedNodeId(nodeId);
      setActivePanelTab("properties");
      setIsDirty(true);
    },
    [sceneDocument, t],
  );

  const setBackgroundColor = useCallback(
    (fill: string) => {
      if (!sceneDocument) {
        return;
      }
      replaceSceneDocument(setSceneBackgroundColor(sceneDocument, fill));
      setSelectedNodeId(BACKGROUND_NODE_ID);
    },
    [replaceSceneDocument, sceneDocument],
  );

  const setBackgroundImage = useCallback(
    async (asset: TemplateAsset) => {
      if (!sceneDocument) {
        return;
      }

      let dimensions;
      try {
        dimensions = await getTemplateAssetDimensions(asset);
      } catch {
        showErrorToast(t("editor.assetInsertFailed"));
        return;
      }

      replaceSceneDocument(
        setSceneBackgroundImage(sceneDocument, asset._id, dimensions),
      );
      setSelectedNodeId(BACKGROUND_NODE_ID);
    },
    [replaceSceneDocument, sceneDocument, t],
  );

  const removeBackgroundImage = useCallback(() => {
    if (!sceneDocument) {
      return;
    }
    replaceSceneDocument(removeSceneBackgroundImage(sceneDocument));
    setSelectedNodeId(BACKGROUND_NODE_ID);
  }, [replaceSceneDocument, sceneDocument]);

  const handleVariableDragStart = useCallback(
    (event: React.DragEvent<HTMLElement>, payload: VariableDragPayload) => {
      event.dataTransfer.effectAllowed = "copy";
      event.dataTransfer.setData(VARIABLE_DRAG_MIME, JSON.stringify(payload));
    },
    [],
  );

  const handleVariableActivate = useCallback(
    (payload: VariableDragPayload) => {
      insertVariableNode(payload, {
        x: Math.round(stageDimensions.width / 2),
        y: Math.round(stageDimensions.height / 2),
      });
    },
    [insertVariableNode, stageDimensions.height, stageDimensions.width],
  );

  const handleAssetDragStart = useCallback(
    (event: React.DragEvent<HTMLElement>, assetId: Id<"templateAssets">) => {
      event.dataTransfer.effectAllowed = "copy";
      event.dataTransfer.setData(ASSET_DRAG_MIME, JSON.stringify({ assetId }));
    },
    [],
  );

  const handleAssetActivate = useCallback(
    (asset: TemplateAsset) => {
      void insertAssetNode(asset, {
        x: Math.round(stageDimensions.width / 2),
        y: Math.round(stageDimensions.height / 2),
      });
    },
    [insertAssetNode, stageDimensions.height, stageDimensions.width],
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
      if (payload) {
        const rect = stageFrameRef.current.getBoundingClientRect();
        const point = {
          x: Math.round((event.clientX - rect.left) / scale),
          y: Math.round((event.clientY - rect.top) / scale),
        };
        insertVariableNode(payload, point);
        return;
      }

      const assetPayload = parseAssetDragPayload(
        event.dataTransfer.getData(ASSET_DRAG_MIME),
      );
      const asset = assetPayload
        ? templateAssetsById.get(assetPayload.assetId)
        : null;
      if (asset) {
        const rect = stageFrameRef.current.getBoundingClientRect();
        void insertAssetNode(asset, {
          x: Math.round((event.clientX - rect.left) / scale),
          y: Math.round((event.clientY - rect.top) / scale),
        });
      }
    },
    [insertAssetNode, insertVariableNode, scale, sceneDocument, templateAssetsById],
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
                  templateAssetsById={templateAssetsById}
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
            backgroundNode={backgroundNode}
            templateAssets={templateAssetRows}
            isUploadingAsset={isUploadingAsset}
            deletingAssetId={deletingAssetId}
            automationType={backendAutomationType}
            previewMode={previewMode}
            onTabChange={setActivePanelTab}
            onVariableDragStart={handleVariableDragStart}
            onVariableActivate={handleVariableActivate}
            onAssetUpload={handleUploadAsset}
            onAssetDragStart={handleAssetDragStart}
            onAssetActivate={handleAssetActivate}
            onAssetDelete={handleDeleteAsset}
            onBackgroundColorChange={setBackgroundColor}
            onBackgroundImageChange={setBackgroundImage}
            onBackgroundImageRemove={removeBackgroundImage}
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
  backgroundNode,
  templateAssets,
  isUploadingAsset,
  deletingAssetId,
  automationType,
  previewMode,
  onTabChange,
  onVariableDragStart,
  onVariableActivate,
  onAssetUpload,
  onAssetDragStart,
  onAssetActivate,
  onAssetDelete,
  onBackgroundColorChange,
  onBackgroundImageChange,
  onBackgroundImageRemove,
  onPropertiesChange,
}: {
  activeTab: EditorPanelTab;
  selectedNode: SceneNode | null;
  backgroundNode: SceneNode | null;
  templateAssets: TemplateAsset[];
  isUploadingAsset: boolean;
  deletingAssetId: Id<"templateAssets"> | null;
  automationType: AutomationType;
  previewMode: BindingPreviewMode;
  onTabChange: (tab: EditorPanelTab) => void;
  onVariableDragStart: (
    event: React.DragEvent<HTMLElement>,
    payload: VariableDragPayload,
  ) => void;
  onVariableActivate: (payload: VariableDragPayload) => void;
  onAssetUpload: (file: File) => Promise<TemplateAsset | null>;
  onAssetDragStart: (
    event: React.DragEvent<HTMLElement>,
    assetId: Id<"templateAssets">,
  ) => void;
  onAssetActivate: (asset: TemplateAsset) => void;
  onAssetDelete: (assetId: Id<"templateAssets">) => void;
  onBackgroundColorChange: (fill: string) => void;
  onBackgroundImageChange: (asset: TemplateAsset) => void;
  onBackgroundImageRemove: () => void;
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
    { id: "background", icon: Palette },
    { id: "properties", icon: SlidersHorizontal },
  ];

  return (
    <>
      <div className="min-w-0 flex-1 overflow-y-auto p-4">
        {activeTab === "variables" ? (
          <VariablesPanel
            automationType={automationType}
            onVariableDragStart={onVariableDragStart}
            onVariableActivate={onVariableActivate}
          />
        ) : null}
        {activeTab === "assets" ? (
          <AssetsPanel
            assets={templateAssets}
            isUploading={isUploadingAsset}
            deletingAssetId={deletingAssetId}
            onUpload={onAssetUpload}
            onAssetDragStart={onAssetDragStart}
            onAssetActivate={onAssetActivate}
            onAssetDelete={onAssetDelete}
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
        {activeTab === "background" ? (
          <BackgroundPanel
            backgroundNode={backgroundNode}
            assets={templateAssets}
            isUploading={isUploadingAsset}
            onUpload={onAssetUpload}
            onColorChange={onBackgroundColorChange}
            onImageChange={onBackgroundImageChange}
            onImageRemove={onBackgroundImageRemove}
          />
        ) : null}
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
  onVariableActivate,
}: {
  automationType: AutomationType;
  onVariableDragStart: (
    event: React.DragEvent<HTMLElement>,
    payload: VariableDragPayload,
  ) => void;
  onVariableActivate: (payload: VariableDragPayload) => void;
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
              onActivate={() =>
                onVariableActivate({ kind: "text", bindingKey })
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
              onActivate={() =>
                onVariableActivate({ kind: "image", bindingKey })
              }
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function AssetsPanel({
  assets,
  isUploading,
  deletingAssetId,
  onUpload,
  onAssetDragStart,
  onAssetActivate,
  onAssetDelete,
}: {
  assets: TemplateAsset[];
  isUploading: boolean;
  deletingAssetId: Id<"templateAssets"> | null;
  onUpload: (file: File) => Promise<TemplateAsset | null>;
  onAssetDragStart: (
    event: React.DragEvent<HTMLElement>,
    assetId: Id<"templateAssets">,
  ) => void;
  onAssetActivate: (asset: TemplateAsset) => void;
  onAssetDelete: (assetId: Id<"templateAssets">) => void;
}) {
  const t = useTranslations("app.automations.editor");

  return (
    <div className="space-y-5">
      <PanelHeader
        title={t("assetsPanelTitle")}
        description={t("assetsPanelDescription")}
      />
      <AssetUploadInput
        id="asset-upload"
        label={isUploading ? t("uploadingAsset") : t("uploadAsset")}
        disabled={isUploading}
        onUpload={onUpload}
      />
      {assets.length === 0 ? (
        <p className="border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
          {t("assetsPanelEmpty")}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {assets.map((asset) => (
            <AssetGridItem
              key={asset._id}
              asset={asset}
              isDeleting={deletingAssetId === asset._id}
              onDragStart={onAssetDragStart}
              onActivate={onAssetActivate}
              onDelete={onAssetDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function BackgroundPanel({
  backgroundNode,
  assets,
  isUploading,
  onUpload,
  onColorChange,
  onImageChange,
  onImageRemove,
}: {
  backgroundNode: SceneNode | null;
  assets: TemplateAsset[];
  isUploading: boolean;
  onUpload: (file: File) => Promise<TemplateAsset | null>;
  onColorChange: (fill: string) => void;
  onImageChange: (asset: TemplateAsset) => void;
  onImageRemove: () => void;
}) {
  const t = useTranslations("app.automations.editor");
  const backgroundAssetId =
    backgroundNode?.className === "Image"
      ? stringAttr(backgroundNode.attrs, "assetId")
      : null;
  const backgroundAsset = backgroundAssetId
    ? assets.find((asset) => asset._id === backgroundAssetId)
    : null;
  const backgroundColor =
    backgroundNode?.className === "Rect"
      ? stringAttr(backgroundNode.attrs, "fill") ?? DEFAULT_BACKGROUND_FILL
      : DEFAULT_BACKGROUND_FILL;

  return (
    <div className="space-y-5">
      <PanelHeader
        title={t("backgroundPanelTitle")}
        description={t("backgroundPanelDescription")}
      />
      {backgroundAsset ? (
        <div className="space-y-3 border bg-muted/30 p-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("currentBackgroundImage")}
            </p>
            <p className="mt-1 truncate text-sm font-medium">
              {backgroundAsset.fileName}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("dragBackgroundHint")}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            onClick={onImageRemove}
          >
            <Trash2 aria-hidden />
            {t("removeBackgroundImage")}
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="background-color">{t("backgroundColor")}</Label>
          <Input
            id="background-color"
            type="color"
            value={backgroundColor}
            className="h-11 p-1"
            onChange={(event) => onColorChange(event.target.value)}
          />
        </div>
      )}
      <AssetUploadInput
        id="background-upload"
        label={
          isUploading ? t("uploadingAsset") : t("uploadBackgroundImage")
        }
        disabled={isUploading}
        onUpload={async (file) => {
          const asset = await onUpload(file);
          if (asset) {
            onImageChange(asset);
          }
          return asset;
        }}
      />
      {assets.length > 0 ? (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("chooseExistingBackground")}
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {assets.map((asset) => (
              <button
                key={asset._id}
                type="button"
                aria-label={asset.fileName}
                className={
                  backgroundAssetId === asset._id
                    ? "aspect-square overflow-hidden border border-primary bg-primary/10 ring-2 ring-primary/30"
                    : "aspect-square overflow-hidden border bg-muted hover:border-primary/60"
                }
                onClick={() => onImageChange(asset)}
              >
                <AssetThumbnail asset={asset} className="size-full" />
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AssetUploadInput({
  id,
  label,
  disabled,
  onUpload,
}: {
  id: string;
  label: string;
  disabled: boolean;
  onUpload: (file: File) => Promise<TemplateAsset | null>;
}) {
  return (
    <div className="space-y-2">
      <Input
        id={id}
        type="file"
        accept={ALLOWED_TEMPLATE_ASSET_MIME_TYPES.join(",")}
        disabled={disabled}
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.currentTarget.value = "";
          if (file) {
            void onUpload(file);
          }
        }}
      />
      <Button
        type="button"
        variant="default"
        className="w-full"
        disabled={disabled}
        asChild
      >
        <label htmlFor={id} className="cursor-pointer">
          <UploadCloud aria-hidden />
          {label}
        </label>
      </Button>
    </div>
  );
}

function AssetGridItem({
  asset,
  isDeleting,
  onDragStart,
  onActivate,
  onDelete,
}: {
  asset: TemplateAsset;
  isDeleting: boolean;
  onDragStart: (
    event: React.DragEvent<HTMLElement>,
    assetId: Id<"templateAssets">,
  ) => void;
  onActivate: (asset: TemplateAsset) => void;
  onDelete: (assetId: Id<"templateAssets">) => void;
}) {
  const t = useTranslations("app.automations.editor");

  return (
    <div
      draggable
      role="button"
      tabIndex={0}
      aria-label={asset.fileName}
      className="group relative aspect-square cursor-grab overflow-hidden border bg-muted shadow-sm transition-colors hover:border-primary/60 active:cursor-grabbing"
      onDragStart={(event) => onDragStart(event, asset._id)}
      onDoubleClick={() => onActivate(asset)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onActivate(asset);
        }
      }}
    >
      <AssetThumbnail asset={asset} className="size-full" />
      <Button
        type="button"
        variant="secondary"
        size="icon-xs"
        disabled={isDeleting}
        aria-label={t("deleteAsset")}
        className="absolute right-1.5 top-1.5 opacity-0 shadow-sm transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
        onClick={(event) => {
          event.stopPropagation();
          onDelete(asset._id);
        }}
      >
        <Trash2 aria-hidden />
      </Button>
    </div>
  );
}

function AssetThumbnail({
  asset,
  className = "size-12",
}: {
  asset: TemplateAsset;
  className?: string;
}) {
  if (!asset.url) {
    return <div className={`${className} shrink-0 bg-muted`} aria-hidden />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={asset.url}
      alt=""
      className={`${className} shrink-0 object-cover`}
      draggable={false}
    />
  );
}

function VariableCard({
  title,
  description,
  icon: Icon,
  onDragStart,
  onActivate,
}: {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  onDragStart: (event: React.DragEvent<HTMLElement>) => void;
  onActivate: () => void;
}) {
  return (
    <div
      draggable
      role="button"
      tabIndex={0}
      className="group flex cursor-grab items-center gap-3 border bg-card p-3 text-left shadow-sm transition-colors hover:border-primary/50 active:cursor-grabbing"
      onDragStart={onDragStart}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onActivate();
        }
      }}
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
  templateAssetsById,
  onSelect,
  onChange,
}: {
  node: SceneNode;
  nodeRefs: React.MutableRefObject<Map<string, Konva.Node>>;
  automationType: AutomationType;
  previewMode: BindingPreviewMode;
  templateAssetsById: Map<string, TemplateAsset>;
  onSelect: (nodeId: string) => void;
  onChange: (nodeId: string, attrs: SceneNodeAttrs) => void;
}) {
  const nodeId = stringAttr(node.attrs, "id");
  const isBackground = isBackgroundNode(node);
  const children = node.children?.map((child) => (
    <SceneNodeRenderer
      key={nodeKey(child)}
      node={child}
      nodeRefs={nodeRefs}
      automationType={automationType}
      previewMode={previewMode}
      templateAssetsById={templateAssetsById}
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
        draggable: isBackground ? node.className === "Image" : true,
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
        templateAssetsById={templateAssetsById}
      />
    );
  }

  return null;
}

function SceneImage({
  attrs,
  previewMode,
  templateAssetsById,
  ...sharedProps
}: {
  attrs: SceneNodeAttrs;
  previewMode: BindingPreviewMode;
  templateAssetsById: Map<string, TemplateAsset>;
  id?: string;
  ref?: (node: Konva.Node | null) => void;
  draggable?: boolean;
  onClick?: () => void;
  onTap?: () => void;
  onDragEnd?: (event: Konva.KonvaEventObject<DragEvent>) => void;
  onTransformEnd?: (event: Konva.KonvaEventObject<Event>) => void;
}) {
  const assetId = stringAttr(attrs, "assetId");
  const dynamicSrc = resolveImageSource(attrs, previewMode);
  const staticSrc = assetId ? templateAssetsById.get(assetId)?.url ?? null : null;
  const src = dynamicSrc ?? staticSrc;
  const [image] = useImage(src ?? "", "anonymous");
  const x = numberAttr(attrs, "x", 0);
  const y = numberAttr(attrs, "y", 0);
  const width = numberAttr(attrs, "width", 160);
  const height = numberAttr(attrs, "height", 160);
  const objectFit = getObjectFitMode(attrs.objectFit);

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

  const naturalWidth = image.naturalWidth || image.width || 1;
  const naturalHeight = image.naturalHeight || image.height || 1;
  const crop = isBackgroundNodeAttrs(attrs)
    ? { x: 0, y: 0, width: naturalWidth, height: naturalHeight }
    : calculateObjectFit(
        naturalWidth,
        naturalHeight,
        width,
        height,
        objectFit,
      ).crop;

  return (
    <KonvaImage
      {...sharedProps}
      x={x}
      y={y}
      width={width}
      height={height}
      image={image}
      crop={crop}
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
  const isBackgroundImage = isImage && isBackgroundNode(node);
  const supportsFill = node.className === "Rect" || node.className === "Text";
  const textBindingKey = isText
    ? getTextBindingKey(node.attrs.bindingKey, automationType)
    : null;
  const availableTextBindingKeys = isText
    ? getAvailableTextBindingKeys(automationType)
    : [];
  const hasTextBindingOptions = availableTextBindingKeys.length > 0;
  const imageBindingKey = isImage ? getImageBindingKey(node.attrs.bindingKey) : null;
  const imageAssetId = isImage ? stringAttr(node.attrs, "assetId") : null;
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
                    textBindingKey ?? availableTextBindingKeys[0];
                  if (!nextBindingKey) {
                    return;
                  }
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
                  <SelectItem value="variable" disabled={!hasTextBindingOptions}>
                    {t("variable")}
                  </SelectItem>
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
                    {availableTextBindingKeys.map((bindingKey) => (
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

      {isImage && imageAssetId ? (
        <div className="space-y-3 border-t pt-4">
          <div>
            <h3 className="text-sm font-medium">{t("content")}</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("staticImageContentDescription")}
            </p>
          </div>
        </div>
      ) : null}

      {isImage && !isBackgroundImage ? (
        <div className="space-y-2">
          <Label htmlFor="image-object-fit">{t("objectFit")}</Label>
          <Select
            value={getObjectFitMode(node.attrs.objectFit)}
            onValueChange={(value) =>
              onChange({ objectFit: value as ObjectFitMode })
            }
          >
            <SelectTrigger id="image-object-fit" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cover">{t("objectFitCover")}</SelectItem>
              <SelectItem value="contain">{t("objectFitContain")}</SelectItem>
              <SelectItem value="fill">{t("objectFitFill")}</SelectItem>
            </SelectContent>
          </Select>
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

function createAssetImageNode(
  sceneDocument: SceneDocument,
  nodeId: string,
  asset: TemplateAsset,
  dimensions: { width: number; height: number },
  point?: { x: number; y: number },
): SceneNode {
  const stageWidth = numberAttr(sceneDocument.stage.attrs, "width", 1080);
  const stageHeight = numberAttr(sceneDocument.stage.attrs, "height", 1080);
  const width = Math.round(dimensions.width);
  const height = Math.round(dimensions.height);
  const x = point ? point.x - Math.round(width / 2) : stageWidth / 2 - width / 2;
  const y = point ? point.y - Math.round(height / 2) : stageHeight / 2 - height / 2;
  const minX = Math.min(0, stageWidth - width);
  const maxX = Math.max(0, stageWidth - width);
  const minY = Math.min(0, stageHeight - height);
  const maxY = Math.max(0, stageHeight - height);

  return {
    className: "Image",
    attrs: {
      id: nodeId,
      name: asset.fileName,
      x: Math.round(clamp(x, minX, maxX)),
      y: Math.round(clamp(y, minY, maxY)),
      width,
      height,
      assetId: asset._id,
      objectFit: "contain",
    },
  };
}

function findBackgroundNode(sceneDocument: SceneDocument): SceneNode | null {
  return (
    sceneDocument.stage.children
      ?.find((node) => node.className === "Layer")
      ?.children?.find(isBackgroundNode) ?? null
  );
}

function isBackgroundNode(node: SceneNode): boolean {
  return stringAttr(node.attrs, "id") === BACKGROUND_NODE_ID;
}

function isBackgroundNodeAttrs(attrs: SceneNodeAttrs): boolean {
  return stringAttr(attrs, "id") === BACKGROUND_NODE_ID;
}

function setSceneBackgroundColor(
  sceneDocument: SceneDocument,
  fill: string,
): SceneDocument {
  return setSceneBackgroundNode(
    sceneDocument,
    createBackgroundRectNode(sceneDocument, fill),
  );
}

function setSceneBackgroundImage(
  sceneDocument: SceneDocument,
  assetId: Id<"templateAssets">,
  dimensions: { width: number; height: number },
): SceneDocument {
  return setSceneBackgroundNode(
    sceneDocument,
    createBackgroundImageNode(sceneDocument, assetId, dimensions),
  );
}

function removeSceneBackgroundImage(sceneDocument: SceneDocument): SceneDocument {
  return setSceneBackgroundColor(sceneDocument, DEFAULT_BACKGROUND_FILL);
}

function setSceneBackgroundNode(
  sceneDocument: SceneDocument,
  backgroundNode: SceneNode,
): SceneDocument {
  let hasUpdatedLayer = false;
  const children = sceneDocument.stage.children?.map((child) => {
    if (!hasUpdatedLayer && child.className === "Layer") {
      hasUpdatedLayer = true;
      return {
        ...child,
        children: [
          backgroundNode,
          ...(child.children ?? []).filter((node) => !isBackgroundNode(node)),
        ],
      };
    }
    return child;
  });

  if (children && hasUpdatedLayer) {
    return {
      ...sceneDocument,
      stage: { ...sceneDocument.stage, children },
    };
  }

  return {
    ...sceneDocument,
    stage: {
      ...sceneDocument.stage,
      children: [
        { className: "Layer", attrs: {}, children: [backgroundNode] },
        ...(sceneDocument.stage.children ?? []),
      ],
    },
  };
}

function createBackgroundRectNode(
  sceneDocument: SceneDocument,
  fill: string,
): SceneNode {
  const stageWidth = numberAttr(sceneDocument.stage.attrs, "width", 1080);
  const stageHeight = numberAttr(sceneDocument.stage.attrs, "height", 1080);

  return {
    className: "Rect",
    attrs: {
      id: BACKGROUND_NODE_ID,
      name: "Background",
      x: 0,
      y: 0,
      width: stageWidth,
      height: stageHeight,
      fill,
    },
  };
}

function createBackgroundImageNode(
  sceneDocument: SceneDocument,
  assetId: Id<"templateAssets">,
  dimensions: { width: number; height: number },
): SceneNode {
  const stageWidth = numberAttr(sceneDocument.stage.attrs, "width", 1080);
  const stageHeight = numberAttr(sceneDocument.stage.attrs, "height", 1080);
  const scale = Math.max(
    stageWidth / dimensions.width,
    stageHeight / dimensions.height,
  );
  const width = Math.round(dimensions.width * scale);
  const height = Math.round(dimensions.height * scale);

  return {
    className: "Image",
    attrs: {
      id: BACKGROUND_NODE_ID,
      name: "Background",
      x: Math.round((stageWidth - width) / 2),
      y: Math.round((stageHeight - height) / 2),
      width,
      height,
      assetId,
      objectFit: "fill",
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

function parseAssetDragPayload(rawPayload: string): AssetDragPayload | null {
  if (!rawPayload) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawPayload) as Partial<AssetDragPayload>;
    if (typeof parsed.assetId === "string") {
      return { assetId: parsed.assetId as Id<"templateAssets"> };
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function getImageFileDimensions(
  file: File,
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new window.Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve({
        width: image.naturalWidth,
        height: image.naturalHeight,
      });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image dimensions"));
    };
    image.src = url;
  });
}

async function getTemplateAssetDimensions(
  asset: TemplateAsset,
): Promise<{ width: number; height: number }> {
  if (asset.pixelWidth && asset.pixelHeight) {
    return { width: asset.pixelWidth, height: asset.pixelHeight };
  }

  if (asset.url) {
    return await getImageUrlDimensions(asset.url);
  }

  throw new Error("Could not read image dimensions");
}

function getImageUrlDimensions(
  src: string,
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new window.Image();

    image.onload = () => {
      if (image.naturalWidth <= 0 || image.naturalHeight <= 0) {
        reject(new Error("Could not read image dimensions"));
        return;
      }
      resolve({
        width: image.naturalWidth,
        height: image.naturalHeight,
      });
    };
    image.onerror = () => reject(new Error("Could not read image dimensions"));
    image.src = src;
  });
}

function nodeKey(node: SceneNode): string {
  return stringAttr(node.attrs, "id") ?? `${node.className}-${JSON.stringify(node.attrs)}`;
}
