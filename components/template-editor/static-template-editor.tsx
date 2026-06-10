"use client";

import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowLeft,
  Bold,
  Circle,
  Italic,
  Minus,
  Plus,
  Underline,
  Eye,
  EyeOff,
  GripVertical,
  ImageIcon,
  ImagePlay,
  Layers,
  Lock,
  Redo2,
  Save,
  Shapes,
  SlidersHorizontal,
  Square,
  Palette,
  Trash2,
  Type,
  Undo2,
  Unlock,
  UploadCloud,
} from "lucide-react";
import type Konva from "konva";
import Link from "next/link";
import { useTranslations } from "next-intl";
import useImage from "use-image";
import {
  useCallback,
  useEffect,
  useId,
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
  getTextOverflowMode,
  getTextTransform,
  getTextBindingKey,
  buildKonvaFontStyle,
  calculateObjectFit,
  calculateTextFit,
  ellipsizeText,
  getTextDecoration,
  collectSceneFontFamilies,
  loadGoogleFonts,
  measureTextForFit,
  normalizeSceneDocument,
  parseKonvaFontStyle,
  toggleUnderline,
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
  type TextOverflowMode,
} from "@/lib/template-scene";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  toBackendAutomationType,
  type AutomationTypeSlug,
  type CanvasPreset,
} from "@/lib/automations/types";
import { CANVAS_PRESET_LABELS } from "@/lib/automations/canvas-presets";
import { showErrorToast, showSuccessToast } from "@/lib/user-feedback";
import { useMutation, useQuery, useAction } from "convex/react";
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
import { FontPicker } from "@/components/template-editor/font-picker";

const VARIABLE_DRAG_MIME = "application/x-matchscore-template-variable";
const ASSET_DRAG_MIME = "application/x-matchscore-template-asset";
const TEXT_PRESET_DRAG_MIME = "application/x-matchscore-template-text-preset";
const BACKGROUND_NODE_ID = "background";
const DEFAULT_BACKGROUND_FILL = "#ffffff";
const MAX_HISTORY_ENTRIES = 50;

type EditorPanelTab =
  | "variables"
  | "assets"
  | "layers"
  | "text"
  | "shapes"
  | "background"
  | "properties";

type VariableDragPayload =
  | { kind: "text"; bindingKey: TextBindingKey }
  | { kind: "image"; bindingKey: ImageBindingKey };

type AssetDragPayload = { assetId: Id<"templateAssets"> };

type TextPresetKind = "heading" | "subheading" | "body";

type TextPresetDragPayload = {
  kind: "text-preset";
  preset: TextPresetKind;
  text: string;
};

const TEXT_PRESET_STYLES: Record<
  TextPresetKind,
  { fontSize: number; fontStyle?: string; lineHeight?: number }
> = {
  heading: { fontSize: 96, fontStyle: "bold", lineHeight: 1.1 },
  subheading: { fontSize: 64, fontStyle: "bold", lineHeight: 1.15 },
  body: { fontSize: 40, lineHeight: 1.2 },
};

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

type SceneHistory = {
  entries: SceneDocument[];
  index: number;
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
  const renderTemplateTest = useAction(api.automations.actions.renderTemplateTest);
  const templateAssets = useQuery(api.templateAssets.queries.listTemplateAssets);
  const backendAutomationType = toBackendAutomationType(automationType);
  const initialSceneDocument = useMemo(() => {
    try {
      return normalizeSceneDocument(
        template.sceneDocument,
        template.canvasPreset,
        backendAutomationType,
      );
    } catch {
      return null;
    }
  }, [backendAutomationType, template.canvasPreset, template.sceneDocument]);
  const [templateName, setTemplateName] = useState(template.name);
  const [sceneDocument, setSceneDocument] =
    useState<SceneDocument | null>(initialSceneDocument);
  const [history, setHistory] = useState(() =>
    createInitialHistory(initialSceneDocument),
  );
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
  const [editingTextNodeId, setEditingTextNodeId] = useState<string | null>(null);
  const [isRenderingTest, setIsRenderingTest] = useState(false);
  const [renderPreviewUrl, setRenderPreviewUrl] = useState<string | null>(null);
  const [renderPreviewOpen, setRenderPreviewOpen] = useState(false);
  const [editingTextValue, setEditingTextValue] = useState("");
  const nodeRefs = useRef(new Map<string, Konva.Node>());
  const transformerRef = useRef<Konva.Transformer>(null);
  const titleMeasureRef = useRef<HTMLSpanElement>(null);
  const stageFrameRef = useRef<HTMLDivElement>(null);
  const textEditorRef = useRef<HTMLTextAreaElement>(null);
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
    if (!sceneDocument) {
      return;
    }

    loadGoogleFonts(collectSceneFontFamilies(sceneDocument.stage));
  }, [sceneDocument]);

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
  const contentLayerNodes = useMemo(
    () => (sceneDocument ? getContentLayerChildren(sceneDocument) : []),
    [sceneDocument],
  );
  const editingTextNode = useMemo(
    () =>
      sceneDocument && editingTextNodeId
        ? findSceneNodeById(sceneDocument.stage, editingTextNodeId)
        : null,
    [editingTextNodeId, sceneDocument],
  );
  const canUndo = history.index > 0;
  const canRedo = history.index >= 0 && history.index < history.entries.length - 1;

  useEffect(() => {
    const transformer = transformerRef.current;
    if (!transformer) {
      return;
    }

    const selectedKonvaNode =
      selectedNode &&
      !isLockedNode(selectedNode) &&
      selectedNodeId !== editingTextNodeId &&
      !(isBackgroundNode(selectedNode) && selectedNode.className !== "Image")
        ? selectedNodeId
          ? nodeRefs.current.get(selectedNodeId)
          : null
        : null;
    transformer.nodes(selectedKonvaNode ? [selectedKonvaNode] : []);
    transformer.getLayer()?.batchDraw();
  }, [editingTextNodeId, sceneDocument, selectedNode, selectedNodeId]);

  useLayoutEffect(() => {
    const measuredWidth = titleMeasureRef.current?.offsetWidth ?? 0;
    setTitleInputWidth(Math.max(Math.ceil(measuredWidth) + 10, 40));
  }, [templateName]);

  useEffect(() => {
    if (editingTextNodeId) {
      textEditorRef.current?.focus();
      textEditorRef.current?.select();
    }
  }, [editingTextNodeId]);

  const commitSceneDocument = useCallback(
    (
      nextSceneDocument:
        | SceneDocument
        | ((current: SceneDocument) => SceneDocument),
    ) => {
      setSceneDocument((current) => {
        if (!current) {
          return current;
        }

        const next =
          typeof nextSceneDocument === "function"
            ? nextSceneDocument(current)
            : nextSceneDocument;
        setHistory((currentHistory) => pushHistoryEntry(currentHistory, next));
        setIsDirty(true);
        return next;
      });
    },
    [],
  );

  const updateSceneAttrs = useCallback(
    (nodeId: string, attrs: SceneNodeAttrs) => {
      commitSceneDocument((current) => updateSceneNodeAttrs(current, nodeId, attrs));
    },
    [commitSceneDocument],
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

  const replaceSceneDocument = commitSceneDocument;

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

  const deleteSelectedNode = useCallback(() => {
    if (!selectedNodeId || !selectedNode || isBackgroundNode(selectedNode)) {
      return;
    }

    commitSceneDocument((current) => removeSceneNode(current, selectedNodeId));
    setSelectedNodeId(null);
    setEditingTextNodeId(null);
  }, [commitSceneDocument, selectedNode, selectedNodeId]);

  const deleteLayerNode = useCallback(
    (node: SceneNode) => {
      const nodeId = stringAttr(node.attrs, "id");
      if (!nodeId || isBackgroundNode(node)) {
        return;
      }

      commitSceneDocument((current) => removeSceneNode(current, nodeId));
      if (selectedNodeId === nodeId) {
        setSelectedNodeId(null);
      }
      if (editingTextNodeId === nodeId) {
        setEditingTextNodeId(null);
      }
    },
    [commitSceneDocument, editingTextNodeId, selectedNodeId],
  );

  const reorderLayerNode = useCallback(
    (
      draggedNodeId: string,
      targetNodeId: string,
      placement: "above" | "below",
    ) => {
      if (draggedNodeId === targetNodeId) {
        return;
      }

      commitSceneDocument((current) =>
        reorderContentLayerNode(current, draggedNodeId, targetNodeId, placement),
      );
    },
    [commitSceneDocument],
  );

  const toggleLayerVisibility = useCallback(
    (node: SceneNode) => {
      const nodeId = stringAttr(node.attrs, "id");
      if (!nodeId || isBackgroundNode(node)) {
        return;
      }
      updateSceneAttrs(nodeId, { visible: node.attrs.visible === false });
    },
    [updateSceneAttrs],
  );

  const toggleLayerLock = useCallback(
    (node: SceneNode) => {
      const nodeId = stringAttr(node.attrs, "id");
      if (!nodeId || isBackgroundNode(node)) {
        return;
      }
      updateSceneAttrs(nodeId, { locked: node.attrs.locked !== true });
    },
    [updateSceneAttrs],
  );

  const startTextEditing = useCallback(
    (nodeId: string) => {
      const node = sceneDocument
        ? findSceneNodeById(sceneDocument.stage, nodeId)
        : null;
      if (
        !node ||
        node.className !== "Text" ||
        getTextBindingKey(node.attrs.bindingKey, backendAutomationType) ||
        isLockedNode(node)
      ) {
        return;
      }

      setSelectedNodeId(nodeId);
      setEditingTextNodeId(nodeId);
      setEditingTextValue(stringAttr(node.attrs, "text") ?? "");
    },
    [backendAutomationType, sceneDocument],
  );

  const cancelTextEditing = useCallback(() => {
    setEditingTextNodeId(null);
    setEditingTextValue("");
  }, []);

  const commitTextEditing = useCallback(() => {
    if (!editingTextNodeId) {
      return;
    }

    updateSceneAttrs(editingTextNodeId, { text: editingTextValue });
    cancelTextEditing();
  }, [cancelTextEditing, editingTextNodeId, editingTextValue, updateSceneAttrs]);

  const undoSceneChange = useCallback(() => {
    const flushed = flushInlineTextEditingState({
      sceneDocument,
      history,
      editingTextNodeId,
      editingTextValue,
    });
    if (flushed.didFlush) {
      cancelTextEditing();
    }

    const workingHistory = flushed.history;
    if (workingHistory.index <= 0) {
      if (flushed.didFlush) {
        setSceneDocument(flushed.sceneDocument);
        setHistory(workingHistory);
        setIsDirty(true);
      }
      return;
    }

    const nextIndex = workingHistory.index - 1;
    setSceneDocument(workingHistory.entries[nextIndex] ?? null);
    setHistory({ ...workingHistory, index: nextIndex });
    setIsDirty(true);
  }, [
    cancelTextEditing,
    editingTextNodeId,
    editingTextValue,
    history,
    sceneDocument,
  ]);

  const redoSceneChange = useCallback(() => {
    const flushed = flushInlineTextEditingState({
      sceneDocument,
      history,
      editingTextNodeId,
      editingTextValue,
    });
    if (flushed.didFlush) {
      cancelTextEditing();
    }

    const workingHistory = flushed.history;
    if (workingHistory.index >= workingHistory.entries.length - 1) {
      if (flushed.didFlush) {
        setSceneDocument(flushed.sceneDocument);
        setHistory(workingHistory);
        setIsDirty(true);
      }
      return;
    }

    const nextIndex = workingHistory.index + 1;
    setSceneDocument(workingHistory.entries[nextIndex] ?? null);
    setHistory({ ...workingHistory, index: nextIndex });
    setIsDirty(true);
  }, [
    cancelTextEditing,
    editingTextNodeId,
    editingTextValue,
    history,
    sceneDocument,
  ]);

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

  const insertTextPresetNode = useCallback(
    (
      preset: TextPresetKind,
      text: string,
      point: { x: number; y: number },
    ) => {
      if (!sceneDocument) {
        return;
      }

      const nodeId = `text-${preset}-${Date.now()}`;
      const node = createFixedTextNode(
        sceneDocument,
        nodeId,
        preset,
        point,
        text,
      );

      commitSceneDocument((current) => appendSceneNodeToFirstLayer(current, node));
      setSelectedNodeId(nodeId);
      setActivePanelTab("properties");
    },
    [commitSceneDocument, sceneDocument],
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

      commitSceneDocument((current) => appendSceneNodeToFirstLayer(current, node));
      setSelectedNodeId(nodeId);
      setActivePanelTab("properties");
    },
    [commitSceneDocument, sceneDocument],
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

      commitSceneDocument((current) =>
        appendSceneNodeToFirstLayer(
          current,
          createAssetImageNode(current, nodeId, asset, dimensions, point),
        ),
      );
      setSelectedNodeId(nodeId);
      setActivePanelTab("properties");
    },
    [commitSceneDocument, sceneDocument, t],
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
      let dimensions;
      try {
        dimensions = await getTemplateAssetDimensions(asset);
      } catch {
        showErrorToast(t("editor.assetInsertFailed"));
        return;
      }

      replaceSceneDocument((current) =>
        setSceneBackgroundImage(current, asset._id, dimensions),
      );
      setSelectedNodeId(BACKGROUND_NODE_ID);
    },
    [replaceSceneDocument, t],
  );

  const removeBackgroundImage = useCallback(() => {
    if (!sceneDocument) {
      return;
    }
    replaceSceneDocument(removeSceneBackgroundImage(sceneDocument));
    setSelectedNodeId(BACKGROUND_NODE_ID);
  }, [replaceSceneDocument, sceneDocument]);

  const handleTextPresetDragStart = useCallback(
    (
      event: React.DragEvent<HTMLElement>,
      payload: TextPresetDragPayload,
    ) => {
      event.dataTransfer.effectAllowed = "copy";
      event.dataTransfer.setData(TEXT_PRESET_DRAG_MIME, JSON.stringify(payload));
    },
    [],
  );

  const handleTextPresetInsert = useCallback(
    (
      preset: TextPresetKind,
      text: string,
      point?: { x: number; y: number },
    ) => {
      insertTextPresetNode(
        preset,
        text,
        point ?? {
          x: Math.round(stageDimensions.width / 2),
          y: Math.round(stageDimensions.height / 2),
        },
      );
    },
    [
      insertTextPresetNode,
      stageDimensions.height,
      stageDimensions.width,
    ],
  );

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

      const textPresetPayload = parseTextPresetDragPayload(
        event.dataTransfer.getData(TEXT_PRESET_DRAG_MIME),
      );
      if (textPresetPayload) {
        const rect = stageFrameRef.current.getBoundingClientRect();
        insertTextPresetNode(textPresetPayload.preset, textPresetPayload.text, {
          x: Math.round((event.clientX - rect.left) / scale),
          y: Math.round((event.clientY - rect.top) / scale),
        });
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
    [
      insertAssetNode,
      insertTextPresetNode,
      insertVariableNode,
      scale,
      sceneDocument,
      templateAssetsById,
    ],
  );

  const handleSave = useCallback(async () => {
    const flushed = flushInlineTextEditingState({
      sceneDocument,
      history,
      editingTextNodeId,
      editingTextValue,
    });
    const documentToSave = flushed.sceneDocument;
    if (!documentToSave) {
      return;
    }

    if (flushed.didFlush) {
      cancelTextEditing();
      setSceneDocument(documentToSave);
      setHistory(flushed.history);
    }

    setIsSaving(true);
    try {
      const normalizedSceneDocument = normalizeSceneDocument(
        documentToSave,
        template.canvasPreset,
        backendAutomationType,
      );
      await updateTemplate({
        templateId: template._id,
        name: templateName,
        sceneDocument: normalizedSceneDocument,
      });
      setSceneDocument(normalizedSceneDocument);
      setHistory((currentHistory) =>
        replaceCurrentHistoryEntry(currentHistory, normalizedSceneDocument),
      );
      setIsDirty(false);
      showSuccessToast(t("editor.saveSuccess"));
    } catch {
      showErrorToast(t("editor.saveFailed"));
    } finally {
      setIsSaving(false);
    }
  }, [
    backendAutomationType,
    cancelTextEditing,
    editingTextNodeId,
    editingTextValue,
    history,
    sceneDocument,
    t,
    template._id,
    template.canvasPreset,
    templateName,
    updateTemplate,
  ]);

  const handleRenderTest = useCallback(async () => {
    if (!sceneDocument) {
      return;
    }

    setIsRenderingTest(true);
    try {
      const result = await renderTemplateTest({
        templateId: template._id,
        sceneDocument,
      });
      setRenderPreviewUrl(result.previewUrl);
      setRenderPreviewOpen(true);
      showSuccessToast(t("editor.renderTestSuccess"));
    } catch {
      showErrorToast(t("editor.renderTestFailed"));
    } finally {
      setIsRenderingTest(false);
    }
  }, [renderTemplateTest, sceneDocument, t, template._id]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableShortcutTarget(event.target)) {
        return;
      }

      const isModifierPressed = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();

      if (isModifierPressed && key === "s") {
        event.preventDefault();
        if (isDirty && !isSaving) {
          void handleSave();
        }
        return;
      }

      if (isModifierPressed && key === "z") {
        event.preventDefault();
        if (event.shiftKey) {
          redoSceneChange();
        } else {
          undoSceneChange();
        }
        return;
      }

      if (isModifierPressed && key === "y") {
        event.preventDefault();
        redoSceneChange();
        return;
      }

      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        deleteSelectedNode();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    deleteSelectedNode,
    handleSave,
    isDirty,
    isSaving,
    redoSceneChange,
    undoSceneChange,
  ]);

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
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              disabled={!canUndo}
              aria-label={t("editor.undo")}
              onClick={undoSceneChange}
            >
              <Undo2 aria-hidden />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              disabled={!canRedo}
              aria-label={t("editor.redo")}
              onClick={redoSceneChange}
            >
              <Redo2 aria-hidden />
            </Button>
          </div>
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
            variant="outline"
            size="sm"
            disabled={isRenderingTest || isSaving}
            onClick={() => void handleRenderTest()}
          >
            <ImagePlay aria-hidden />
            {isRenderingTest ? t("editor.renderTestRunning") : t("editor.renderTest")}
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
            className="relative overflow-hidden border bg-background shadow-sm"
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
                  editingTextNodeId={editingTextNodeId}
                  onSelect={selectNode}
                  onTextEditStart={startTextEditing}
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
            {editingTextNode ? (
              <EditableTextOverlay
                node={editingTextNode}
                scale={scale}
                value={editingTextValue}
                textareaRef={textEditorRef}
                onChange={setEditingTextValue}
                onCommit={commitTextEditing}
                onCancel={cancelTextEditing}
              />
            ) : null}
          </div>
        </main>

        <aside className="flex w-[23rem] shrink-0 border-l bg-background">
          <EditorRightPanel
            activeTab={activePanelTab}
            selectedNode={selectedNode}
            backgroundNode={backgroundNode}
            contentLayerNodes={contentLayerNodes}
            selectedNodeId={selectedNodeId}
            templateAssets={templateAssetRows}
            isUploadingAsset={isUploadingAsset}
            deletingAssetId={deletingAssetId}
            automationType={backendAutomationType}
            previewMode={previewMode}
            onTabChange={setActivePanelTab}
            onNodeSelect={selectNode}
            onLayerReorder={reorderLayerNode}
            onLayerVisibilityToggle={toggleLayerVisibility}
            onLayerLockToggle={toggleLayerLock}
            onLayerDelete={deleteLayerNode}
            onNodeDelete={deleteSelectedNode}
            onTextPresetDragStart={handleTextPresetDragStart}
            onTextPresetInsert={handleTextPresetInsert}
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

      <AlertDialog open={renderPreviewOpen} onOpenChange={setRenderPreviewOpen}>
        <AlertDialogContent className="max-w-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("editor.renderTestTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("editor.renderTestDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {renderPreviewUrl ? (
            <div className="overflow-hidden rounded-md border bg-muted/20 p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={renderPreviewUrl}
                alt={t("editor.renderTestImageAlt")}
                className="mx-auto max-h-[70vh] w-auto max-w-full object-contain"
              />
            </div>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setRenderPreviewOpen(false)}>
              {t("editor.renderTestClose")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function EditorRightPanel({
  activeTab,
  selectedNode,
  backgroundNode,
  contentLayerNodes,
  selectedNodeId,
  templateAssets,
  isUploadingAsset,
  deletingAssetId,
  automationType,
  previewMode,
  onTabChange,
  onNodeSelect,
  onLayerReorder,
  onLayerVisibilityToggle,
  onLayerLockToggle,
  onLayerDelete,
  onNodeDelete,
  onTextPresetDragStart,
  onTextPresetInsert,
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
  contentLayerNodes: SceneNode[];
  selectedNodeId: string | null;
  templateAssets: TemplateAsset[];
  isUploadingAsset: boolean;
  deletingAssetId: Id<"templateAssets"> | null;
  automationType: AutomationType;
  previewMode: BindingPreviewMode;
  onTabChange: (tab: EditorPanelTab) => void;
  onNodeSelect: (nodeId: string) => void;
  onLayerReorder: (
    draggedNodeId: string,
    targetNodeId: string,
    placement: "above" | "below",
  ) => void;
  onLayerVisibilityToggle: (node: SceneNode) => void;
  onLayerLockToggle: (node: SceneNode) => void;
  onLayerDelete: (node: SceneNode) => void;
  onNodeDelete: () => void;
  onTextPresetDragStart: (
    event: React.DragEvent<HTMLElement>,
    payload: TextPresetDragPayload,
  ) => void;
  onTextPresetInsert: (
    preset: TextPresetKind,
    text: string,
    point?: { x: number; y: number },
  ) => void;
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
  onAssetDelete: (assetId: Id<"templateAssets">) => Promise<void>;
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
    { id: "layers", icon: Layers },
    { id: "text", icon: Type },
    { id: "shapes", icon: Shapes },
    { id: "background", icon: Palette },
    { id: "properties", icon: SlidersHorizontal },
  ];

  return (
    <>
      <div className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-3">
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
        {activeTab === "layers" ? (
          <LayersPanel
            nodes={contentLayerNodes}
            selectedNodeId={selectedNodeId}
            onSelect={onNodeSelect}
            onReorder={onLayerReorder}
            onVisibilityToggle={onLayerVisibilityToggle}
            onLockToggle={onLayerLockToggle}
            onDelete={onLayerDelete}
          />
        ) : null}
        {activeTab === "text" ? (
          <TextPanel
            onTextPresetDragStart={onTextPresetDragStart}
            onTextPresetInsert={onTextPresetInsert}
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
            onDelete={onNodeDelete}
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

function TextPanel({
  onTextPresetDragStart,
  onTextPresetInsert,
}: {
  onTextPresetDragStart: (
    event: React.DragEvent<HTMLElement>,
    payload: TextPresetDragPayload,
  ) => void;
  onTextPresetInsert: (
    preset: TextPresetKind,
    text: string,
    point?: { x: number; y: number },
  ) => void;
}) {
  const t = useTranslations("app.automations.editor");
  const presets: Array<{
    preset: TextPresetKind;
    label: string;
    previewClassName: string;
  }> = [
    {
      preset: "heading",
      label: t("textPresetHeading"),
      previewClassName: "text-2xl font-bold leading-tight",
    },
    {
      preset: "subheading",
      label: t("textPresetSubheading"),
      previewClassName: "text-lg font-bold leading-tight",
    },
    {
      preset: "body",
      label: t("textPresetBody"),
      previewClassName: "text-sm font-normal",
    },
  ];

  const getPresetPlaceholder = (preset: TextPresetKind) => {
    switch (preset) {
      case "heading":
        return t("textPresetHeadingPlaceholder");
      case "subheading":
        return t("textPresetSubheadingPlaceholder");
      case "body":
        return t("textPresetBodyPlaceholder");
    }
  };

  return (
    <div className="space-y-5">
      <PanelHeader
        title={t("textPanelTitle")}
        description={t("textPanelDescription")}
      />

      <Button
        type="button"
        className="h-10 w-full"
        onClick={() =>
          onTextPresetInsert("body", getPresetPlaceholder("body"))
        }
      >
        <Type aria-hidden />
        {t("textPanelAddTextBox")}
      </Button>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">{t("textPresetStylesTitle")}</h3>
        <div className="grid gap-2">
          {presets.map(({ preset, label, previewClassName }) => (
            <TextPresetCard
              key={preset}
              label={label}
              previewClassName={previewClassName}
              onDragStart={(event) =>
                onTextPresetDragStart(event, {
                  kind: "text-preset",
                  preset,
                  text: getPresetPlaceholder(preset),
                })
              }
              onActivate={() =>
                onTextPresetInsert(preset, getPresetPlaceholder(preset))
              }
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function TextPresetCard({
  label,
  previewClassName,
  onDragStart,
  onActivate,
}: {
  label: string;
  previewClassName: string;
  onDragStart: (event: React.DragEvent<HTMLElement>) => void;
  onActivate: () => void;
}) {
  return (
    <div
      draggable
      role="button"
      tabIndex={0}
      className="cursor-grab border bg-card px-3 py-2.5 text-left transition-colors hover:border-primary/50 active:cursor-grabbing"
      onDragStart={onDragStart}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onActivate();
        }
      }}
    >
      <span className={previewClassName}>{label}</span>
    </div>
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
  onAssetDelete: (assetId: Id<"templateAssets">) => Promise<void>;
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

function LayersPanel({
  nodes,
  selectedNodeId,
  onSelect,
  onReorder,
  onVisibilityToggle,
  onLockToggle,
  onDelete,
}: {
  nodes: SceneNode[];
  selectedNodeId: string | null;
  onSelect: (nodeId: string) => void;
  onReorder: (
    draggedNodeId: string,
    targetNodeId: string,
    placement: "above" | "below",
  ) => void;
  onVisibilityToggle: (node: SceneNode) => void;
  onLockToggle: (node: SceneNode) => void;
  onDelete: (node: SceneNode) => void;
}) {
  const t = useTranslations("app.automations.editor");
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [dropIndicator, setDropIndicator] = useState<{
    nodeId: string;
    placement: "above" | "below";
  } | null>(null);
  const visibleNodes = nodes.filter((node) => stringAttr(node.attrs, "id"));
  const displayNodes = [...visibleNodes].reverse();

  return (
    <div className="space-y-5">
      <PanelHeader
        title={t("layersPanelTitle")}
        description={t("layersPanelDescription")}
      />
      <div className="space-y-2">
        {displayNodes.map((node) => {
          const nodeId = stringAttr(node.attrs, "id");
          if (!nodeId) {
            return null;
          }
          const isBackground = isBackgroundNode(node);
          const isSelected = selectedNodeId === nodeId;
          const isVisible = node.attrs.visible !== false;
          const isLocked = node.attrs.locked === true;
          const isDropTarget = dropIndicator?.nodeId === nodeId;

          return (
            <div
              key={nodeId}
              onDragOver={(event) => {
                if (draggedNodeId && draggedNodeId !== nodeId) {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                  const rect = event.currentTarget.getBoundingClientRect();
                  setDropIndicator({
                    nodeId,
                    placement:
                      event.clientY < rect.top + rect.height / 2
                        ? "above"
                        : "below",
                  });
                }
              }}
              onDragLeave={() => {
                if (dropIndicator?.nodeId === nodeId) {
                  setDropIndicator(null);
                }
              }}
              onDrop={(event) => {
                event.preventDefault();
                if (draggedNodeId && draggedNodeId !== nodeId) {
                  onReorder(
                    draggedNodeId,
                    nodeId,
                    dropIndicator?.nodeId === nodeId
                      ? dropIndicator.placement
                      : "above",
                  );
                }
                setDraggedNodeId(null);
                setDropIndicator(null);
              }}
              className="relative"
            >
              {isDropTarget && dropIndicator.placement === "above" ? (
                <LayerDropIndicator />
              ) : null}
              <div
                draggable={!isBackground}
                aria-label={!isBackground ? t("dragLayer") : undefined}
                onClick={() => onSelect(nodeId)}
                onDragStart={(event) => {
                  if (isBackground) {
                    return;
                  }

                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", nodeId);
                  setDraggedNodeId(nodeId);
                }}
                onDragEnd={() => {
                  setDraggedNodeId(null);
                  setDropIndicator(null);
                }}
                className={
                  isSelected
                    ? "cursor-grab border border-primary bg-primary/10 p-2 active:cursor-grabbing"
                    : isBackground
                      ? "border bg-card p-2"
                      : "cursor-grab border bg-card p-2 active:cursor-grabbing"
                }
              >
              <div className="flex items-center gap-2">
                <div
                  className={
                    isBackground
                      ? "flex size-8 shrink-0 items-center justify-center text-muted-foreground/40"
                      : "flex size-8 shrink-0 items-center justify-center text-muted-foreground"
                  }
                >
                  <GripVertical aria-hidden />
                </div>
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelect(nodeId);
                  }}
                >
                  <span className="block truncate text-sm font-medium">
                    {getLayerLabel(node)}
                  </span>
                  <span className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{node.className}</span>
                    {isBackground ? (
                      <Badge variant="outline">{t("backgroundLayer")}</Badge>
                    ) : null}
                  </span>
                </button>
                <div className="flex shrink-0 items-center -space-x-1.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    disabled={isBackground}
                    aria-label={isVisible ? t("hideLayer") : t("showLayer")}
                    onClick={(event) => {
                      event.stopPropagation();
                      onVisibilityToggle(node);
                    }}
                  >
                    {isVisible ? <Eye aria-hidden /> : <EyeOff aria-hidden />}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    disabled={isBackground}
                    aria-label={isLocked ? t("unlockLayer") : t("lockLayer")}
                    onClick={(event) => {
                      event.stopPropagation();
                      onLockToggle(node);
                    }}
                  >
                    {isLocked ? <Lock aria-hidden /> : <Unlock aria-hidden />}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    disabled={isBackground}
                    aria-label={t("deleteLayer")}
                    onClick={(event) => {
                      event.stopPropagation();
                      onDelete(node);
                    }}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </div>
              </div>
              </div>
              {isDropTarget && dropIndicator.placement === "below" ? (
                <LayerDropIndicator />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LayerDropIndicator() {
  return (
    <div
      className="my-1 flex items-center gap-2"
      aria-hidden
    >
      <div className="size-2 rounded-full bg-primary" />
      <div className="h-0.5 flex-1 bg-primary" />
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
  onDelete: (assetId: Id<"templateAssets">) => Promise<void>;
}) {
  const t = useTranslations("app.automations.editor");
  const [deleteOpen, setDeleteOpen] = useState(false);

  const handleDeleteConfirm = async () => {
    await onDelete(asset._id);
    setDeleteOpen(false);
  };

  return (
    <>
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
            if (!isDeleting) {
              setDeleteOpen(true);
            }
          }}
        >
          <Trash2 aria-hidden />
        </Button>
      </div>

      <AlertDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          if (!isDeleting) {
            setDeleteOpen(open);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteAssetConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteAssetConfirmDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              {t("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                void handleDeleteConfirm();
              }}
            >
              {isDeleting ? t("deletingAsset") : t("deleteAsset")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
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
  onDelete,
}: {
  selectedNode: SceneNode | null;
  automationType: AutomationType;
  previewMode: BindingPreviewMode;
  onChange: (attrs: SceneNodeAttrs) => void;
  onDelete: () => void;
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
    <div className="min-w-0 space-y-2">
      <div className="border bg-muted/30 p-2">
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {t("selectedItem")}
        </p>
        <h2 className="truncate text-sm font-semibold">{selectedLabel}</h2>
      </div>
      <NodePropertiesPanel
        node={selectedNode}
        automationType={automationType}
        previewMode={previewMode}
        onChange={onChange}
        onDelete={onDelete}
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

function TextAlignmentControl({
  value,
  onChange,
  compact = false,
  grid = false,
}: {
  value: string;
  onChange: (align: "left" | "center" | "right") => void;
  compact?: boolean;
  grid?: boolean;
}) {
  const t = useTranslations("app.automations.editor");
  const options: Array<{
    value: "left" | "center" | "right";
    icon: React.ComponentType<{ className?: string }>;
    label: string;
  }> = [
    { value: "left", icon: AlignLeft, label: t("alignLeft") },
    { value: "center", icon: AlignCenter, label: t("alignCenter") },
    { value: "right", icon: AlignRight, label: t("alignRight") },
  ];

  if (grid) {
    return (
      <div className="grid grid-cols-3 gap-0.5">
        {options.map(({ value: optionValue, icon: Icon, label }) => (
          <Button
            key={optionValue}
            type="button"
            variant={value === optionValue ? "default" : "outline"}
            size="sm"
            className="h-7 px-0"
            aria-label={label}
            onClick={() => onChange(optionValue)}
          >
            <Icon aria-hidden />
          </Button>
        ))}
      </div>
    );
  }

  if (compact) {
    return (
      <div className="flex items-center gap-0.5">
        {options.map(({ value: optionValue, icon: Icon, label }) => (
          <Button
            key={optionValue}
            type="button"
            variant={value === optionValue ? "default" : "outline"}
            size="icon-xs"
            aria-label={label}
            aria-pressed={value === optionValue}
            onClick={() => onChange(optionValue)}
          >
            <Icon aria-hidden />
          </Button>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label>{t("alignment")}</Label>
      <div className="grid grid-cols-3 gap-2">
        {options.map(({ value: optionValue, icon: Icon, label }) => (
          <Button
            key={optionValue}
            type="button"
            variant={value === optionValue ? "default" : "outline"}
            size="sm"
            aria-label={label}
            onClick={() => onChange(optionValue)}
          >
            <Icon aria-hidden />
          </Button>
        ))}
      </div>
    </div>
  );
}

function TextStyleToggles({
  bold,
  italic,
  underline,
  uppercase,
  boldLabel,
  italicLabel,
  underlineLabel,
  uppercaseLabel,
  onBoldToggle,
  onItalicToggle,
  onUnderlineToggle,
  onUppercaseToggle,
}: {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  uppercase: boolean;
  boldLabel: string;
  italicLabel: string;
  underlineLabel: string;
  uppercaseLabel: string;
  onBoldToggle: () => void;
  onItalicToggle: () => void;
  onUnderlineToggle: () => void;
  onUppercaseToggle: () => void;
}) {
  return (
    <div className="flex items-center gap-0.5">
      <Button
        type="button"
        variant={bold ? "default" : "outline"}
        size="icon-xs"
        aria-label={boldLabel}
        aria-pressed={bold}
        onClick={onBoldToggle}
      >
        <Bold aria-hidden />
      </Button>
      <Button
        type="button"
        variant={italic ? "default" : "outline"}
        size="icon-xs"
        aria-label={italicLabel}
        aria-pressed={italic}
        onClick={onItalicToggle}
      >
        <Italic aria-hidden />
      </Button>
      <Button
        type="button"
        variant={underline ? "default" : "outline"}
        size="icon-xs"
        aria-label={underlineLabel}
        aria-pressed={underline}
        onClick={onUnderlineToggle}
      >
        <Underline aria-hidden />
      </Button>
      <Button
        type="button"
        variant={uppercase ? "default" : "outline"}
        size="icon-xs"
        aria-label={uppercaseLabel}
        aria-pressed={uppercase}
        onClick={onUppercaseToggle}
      >
        <span aria-hidden className="text-[10px] font-bold leading-none">
          <span className="font-normal">a</span>A
        </span>
      </Button>
    </div>
  );
}

function PanelNumberInput({
  ariaLabel,
  value,
  min,
  className,
  onChange,
}: {
  ariaLabel: string;
  value: number;
  min?: number;
  className?: string;
  onChange: (value: number) => void;
}) {
  return (
    <Input
      type="number"
      aria-label={ariaLabel}
      min={min}
      value={Number.isFinite(value) ? value : 0}
      className={className ?? "h-7 w-12 shrink-0 px-1.5 text-xs"}
      onChange={(event) => {
        const nextValue = Number(event.target.value);
        if (Number.isFinite(nextValue)) {
          onChange(nextValue);
        }
      }}
    />
  );
}

function TextColorPicker({
  value,
  label,
  onChange,
}: {
  value: string;
  label: string;
  onChange: (fill: string) => void;
}) {
  const inputId = useId();
  const normalized = value || "#000000";

  return (
    <label
      htmlFor={inputId}
      className="flex h-10 w-full min-w-0 cursor-pointer items-center gap-3 border border-input bg-background px-2.5 transition-colors hover:bg-muted/40"
    >
      <span
        aria-hidden
        className="size-9 shrink-0 border border-border shadow-sm"
        style={{ backgroundColor: normalized }}
      />
      <span className="min-w-0 flex-1 text-sm font-medium">{label}</span>
      <span className="shrink-0 font-mono text-xs uppercase text-muted-foreground">
        {normalized}
      </span>
      <input
        id={inputId}
        type="color"
        value={normalized}
        className="sr-only"
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function PanelStepperInput({
  ariaLabel,
  decreaseLabel,
  increaseLabel,
  value,
  min,
  max = 9999,
  step = 1,
  decimals = 0,
  className,
  onChange,
}: {
  ariaLabel: string;
  decreaseLabel: string;
  increaseLabel: string;
  value: number;
  min: number;
  max?: number;
  step?: number;
  decimals?: number;
  className?: string;
  onChange: (value: number) => void;
}) {
  const roundValue = (nextValue: number) => {
    if (decimals <= 0) {
      return Math.round(nextValue);
    }

    const factor = 10 ** decimals;
    return Math.round(nextValue * factor) / factor;
  };

  const clampValue = (nextValue: number) =>
    roundValue(Math.min(max, Math.max(min, nextValue)));

  const handleDecrease = () => {
    onChange(clampValue(value - step));
  };

  const handleIncrease = () => {
    onChange(clampValue(value + step));
  };

  return (
    <div
      className={
        className ??
        "flex h-8 w-full min-w-0 items-stretch overflow-hidden border border-input bg-background"
      }
    >
      <button
        type="button"
        className="flex w-9 shrink-0 items-center justify-center border-r text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:bg-muted/80 disabled:pointer-events-none disabled:opacity-40"
        aria-label={decreaseLabel}
        disabled={value <= min}
        onClick={handleDecrease}
      >
        <Minus className="size-4" aria-hidden />
      </button>
      <input
        type="number"
        aria-label={ariaLabel}
        min={min}
        max={max}
        step={step}
        value={Number.isFinite(value) ? value : min}
        className="min-w-0 flex-1 border-0 bg-transparent px-1 text-center text-sm font-medium tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        onChange={(event) => {
          const nextValue = Number(event.target.value);
          if (Number.isFinite(nextValue)) {
            onChange(clampValue(nextValue));
          }
        }}
      />
      <button
        type="button"
        className="flex w-9 shrink-0 items-center justify-center border-l text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:bg-muted/80 disabled:pointer-events-none disabled:opacity-40"
        aria-label={increaseLabel}
        disabled={value >= max}
        onClick={handleIncrease}
      >
        <Plus className="size-4" aria-hidden />
      </button>
    </div>
  );
}

function EditableTextOverlay({
  node,
  scale,
  value,
  textareaRef,
  onChange,
  onCommit,
  onCancel,
}: {
  node: SceneNode;
  scale: number;
  value: string;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  onChange: (value: string) => void;
  onCommit: () => void;
  onCancel: () => void;
}) {
  const x = numberAttr(node.attrs, "x", 0);
  const y = numberAttr(node.attrs, "y", 0);
  const width = numberAttr(node.attrs, "width", 300);
  const height = numberAttr(
    node.attrs,
    "height",
    numberAttr(node.attrs, "fontSize", 48) * 1.4,
  );
  const fontSize = numberAttr(node.attrs, "fontSize", 48);
  const lineHeight = numberAttr(node.attrs, "lineHeight", 1);
  const fontFamily = stringAttr(node.attrs, "fontFamily") ?? "Arial";
  const { bold, italic } = parseKonvaFontStyle(
    stringAttr(node.attrs, "fontStyle"),
  );

  return (
    <textarea
      ref={textareaRef}
      value={value}
      className="absolute z-10 resize-none border border-primary bg-background p-0 outline-none ring-2 ring-primary/25"
      style={{
        left: x * scale,
        top: y * scale,
        width: width * scale,
        height: height * scale,
        color: stringAttr(node.attrs, "fill") ?? "#111827",
        fontSize: fontSize * scale,
        fontFamily,
        fontWeight: bold ? 700 : 400,
        fontStyle: italic ? "italic" : "normal",
        textDecoration: getTextDecoration(
          stringAttr(node.attrs, "textDecoration"),
        ),
        lineHeight,
        textAlign: getCssTextAlign(node.attrs.align),
      }}
      onChange={(event) => onChange(event.target.value)}
      onBlur={onCommit}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onCancel();
          return;
        }
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          onCommit();
        }
      }}
    />
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
  editingTextNodeId,
  onSelect,
  onTextEditStart,
  onChange,
}: {
  node: SceneNode;
  nodeRefs: React.MutableRefObject<Map<string, Konva.Node>>;
  automationType: AutomationType;
  previewMode: BindingPreviewMode;
  templateAssetsById: Map<string, TemplateAsset>;
  editingTextNodeId: string | null;
  onSelect: (nodeId: string) => void;
  onTextEditStart: (nodeId: string) => void;
  onChange: (nodeId: string, attrs: SceneNodeAttrs) => void;
}) {
  const nodeId = stringAttr(node.attrs, "id");
  const isBackground = isBackgroundNode(node);
  const isVisible = node.attrs.visible !== false;
  const isLocked = isLockedNode(node);
  const children = node.children?.map((child) => (
    <SceneNodeRenderer
      key={nodeKey(child)}
      node={child}
      nodeRefs={nodeRefs}
      automationType={automationType}
      previewMode={previewMode}
      templateAssetsById={templateAssetsById}
      editingTextNodeId={editingTextNodeId}
      onSelect={onSelect}
      onTextEditStart={onTextEditStart}
      onChange={onChange}
    />
  ));
  if (!isVisible) {
    return null;
  }
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
        draggable: !isLocked && (isBackground ? node.className === "Image" : true),
        onClick: () => onSelect(nodeId),
        onTap: () => onSelect(nodeId),
        onDragStart: () => onSelect(nodeId),
        onTransformStart: () => onSelect(nodeId),
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
    const text = resolveTextContent(node.attrs, automationType, previewMode);
    const baseFontSize = numberAttr(node.attrs, "fontSize", 48);
    const fontFamily = stringAttr(node.attrs, "fontFamily") ?? "Arial";
    const lineHeight = numberAttr(node.attrs, "lineHeight", 1);
    const overflowMode = getTextOverflowMode(node.attrs.overflowMode);
    const width = numberAttr(node.attrs, "width", 300);
    const height = optionalNumberAttr(node.attrs, "height");
    const fontSize =
      overflowMode === "shrink" && height
        ? calculateTextFit(
            text,
            fontFamily,
            width,
            height,
            baseFontSize,
            measureTextForFit,
          )
        : baseFontSize;

    return (
      <KonvaText
        {...sharedProps}
        x={numberAttr(node.attrs, "x", 0)}
        y={numberAttr(node.attrs, "y", 0)}
        width={width}
        height={height}
        visible={nodeId !== editingTextNodeId}
        text={overflowMode === "ellipsis" ? ellipsizeText(text, width, fontSize) : text}
        fontSize={fontSize}
        fontFamily={fontFamily}
        fontStyle={stringAttr(node.attrs, "fontStyle") ?? "normal"}
        textDecoration={getTextDecoration(
          stringAttr(node.attrs, "textDecoration"),
        )}
        fill={stringAttr(node.attrs, "fill") ?? "#ffffff"}
        align={stringAttr(node.attrs, "align") ?? "left"}
        lineHeight={lineHeight}
        wrap={overflowMode === "fixed" || overflowMode === "ellipsis" ? "none" : "word"}
        onDblClick={() => nodeId && onTextEditStart(nodeId)}
        onDblTap={() => nodeId && onTextEditStart(nodeId)}
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
      <Group
        {...sharedProps}
        x={x}
        y={y}
        width={width}
        height={height}
        clipX={0}
        clipY={0}
        clipWidth={width}
        clipHeight={height}
      >
        <Rect
          x={0}
          y={0}
          width={width}
          height={height}
          fill="#e5e7eb"
        />
      </Group>
    );
  }

  const naturalWidth = image.naturalWidth || image.width || 1;
  const naturalHeight = image.naturalHeight || image.height || 1;
  const fit = isBackgroundNodeAttrs(attrs)
    ? {
        crop: { x: 0, y: 0, width: naturalWidth, height: naturalHeight },
        render: { x: 0, y: 0, width, height },
      }
    : calculateObjectFit(
        naturalWidth,
        naturalHeight,
        width,
        height,
        objectFit,
      );

  return (
    <Group
      {...sharedProps}
      x={x}
      y={y}
      width={width}
      height={height}
      clipX={0}
      clipY={0}
      clipWidth={width}
      clipHeight={height}
    >
      <Rect
        x={0}
        y={0}
        width={width}
        height={height}
        fill="rgba(0,0,0,0)"
      />
      <KonvaImage
        x={fit.render.x}
        y={fit.render.y}
        width={fit.render.width}
        height={fit.render.height}
        image={image}
        crop={fit.crop}
      />
    </Group>
  );
}

function NodePropertiesPanel({
  node,
  automationType,
  previewMode,
  onChange,
  onDelete,
}: {
  node: SceneNode;
  automationType: AutomationType;
  previewMode: BindingPreviewMode;
  onChange: (attrs: SceneNodeAttrs) => void;
  onDelete: () => void;
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
  const imageBindingKey = isImage ? getImageBindingKey(node.attrs.bindingKey) : null;
  const imageAssetId = isImage ? stringAttr(node.attrs, "assetId") : null;
  const canDelete = !isBackgroundNode(node);

  const fontStyle = stringAttr(node.attrs, "fontStyle");
  const { bold, italic } = parseKonvaFontStyle(fontStyle);
  const underlined = getTextDecoration(stringAttr(node.attrs, "textDecoration")) === "underline";
  const isUppercase = getTextTransform(node.attrs.textTransform) === "uppercase";

  return (
    <div className="min-w-0 space-y-2">
      {canDelete ? (
        <Button
          type="button"
          variant="destructive"
          size="xs"
          className="h-7 w-full text-xs"
          onClick={onDelete}
        >
          <Trash2 aria-hidden />
          {t("deleteNode")}
        </Button>
      ) : null}

      {!isText ? (
        <div className="grid grid-cols-2 gap-1.5">
          <PanelNumberInput
            ariaLabel={t("width")}
            value={numberAttr(node.attrs, "width", 0)}
            min={1}
            className="h-7 w-full min-w-0 px-1.5 text-xs"
            onChange={(value) => onChange({ width: value })}
          />
          <PanelNumberInput
            ariaLabel={t("height")}
            value={numberAttr(node.attrs, "height", 0)}
            min={0}
            className="h-7 w-full min-w-0 px-1.5 text-xs"
            onChange={(value) => onChange({ height: value })}
          />
        </div>
      ) : null}

      {supportsFill && !isText ? (
        <Input
          type="color"
          aria-label={t("fill")}
          value={stringAttr(node.attrs, "fill") ?? "#000000"}
          className="h-7 w-9 shrink-0 p-0.5"
          onChange={(event) => onChange({ fill: event.target.value })}
        />
      ) : null}

      {isText ? (
        <>
          {textBindingKey ? (
            <div className="space-y-1.5">
              <Select
                value={textBindingKey}
                onValueChange={(value) =>
                  onChange({ bindingKey: value as TextBindingKey, text: undefined })
                }
              >
                <SelectTrigger
                  aria-label={t("variableBinding")}
                  className="h-7 w-full min-w-0 text-xs"
                >
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
              <p className="truncate text-[10px] text-muted-foreground">
                {t("resolvedPreview", {
                  value: resolveTextContent(node.attrs, automationType, previewMode),
                })}
              </p>
            </div>
          ) : null}

          <div
            className={
              textBindingKey
                ? "min-w-0 space-y-1.5 border-t pt-2"
                : "min-w-0 space-y-1.5"
            }
          >
            <FontPicker
              value={stringAttr(node.attrs, "fontFamily") ?? "Arial"}
              onChange={(fontFamily) => onChange({ fontFamily })}
              searchPlaceholder={t("fontSearchPlaceholder")}
              noResultsLabel={t("fontSearchNoResults")}
            />
            <PanelStepperInput
              ariaLabel={t("fontSize")}
              decreaseLabel={t("decreaseFontSize")}
              increaseLabel={t("increaseFontSize")}
              value={numberAttr(node.attrs, "fontSize", 48)}
              min={1}
              max={400}
              step={1}
              onChange={(value) => onChange({ fontSize: value })}
            />
            <TextColorPicker
              label={t("fill")}
              value={stringAttr(node.attrs, "fill") ?? "#000000"}
              onChange={(fill) => onChange({ fill })}
            />
            <div className="flex min-w-0 flex-nowrap items-center gap-0.5 border border-input bg-muted/20 p-1.5">
              <TextStyleToggles
                bold={bold}
                italic={italic}
                underline={underlined}
                uppercase={isUppercase}
                boldLabel={t("bold")}
                italicLabel={t("italic")}
                underlineLabel={t("underline")}
                uppercaseLabel={t("textTransformUppercase")}
                onBoldToggle={() =>
                  onChange({
                    fontStyle: buildKonvaFontStyle(!bold, italic),
                  })
                }
                onItalicToggle={() =>
                  onChange({
                    fontStyle: buildKonvaFontStyle(bold, !italic),
                  })
                }
                onUnderlineToggle={() =>
                  onChange({
                    textDecoration: toggleUnderline(
                      stringAttr(node.attrs, "textDecoration"),
                    ),
                  })
                }
                onUppercaseToggle={() =>
                  onChange({
                    textTransform: isUppercase ? "none" : "uppercase",
                  })
                }
              />
              <div
                aria-hidden
                className="mx-0.5 h-6 w-px shrink-0 bg-border"
              />
              <TextAlignmentControl
                compact
                value={stringAttr(node.attrs, "align") ?? "left"}
                onChange={(align) => onChange({ align })}
              />
            </div>
            <div className="flex min-w-0 items-center gap-1.5">
              <Select
                value={getTextOverflowMode(node.attrs.overflowMode)}
                onValueChange={(value) =>
                  onChange({ overflowMode: value as TextOverflowMode })
                }
              >
                <SelectTrigger
                  aria-label={t("overflowMode")}
                  className="h-7 min-w-0 flex-1 text-xs"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="wrap">{t("overflowWrap")}</SelectItem>
                  <SelectItem value="shrink">{t("overflowShrink")}</SelectItem>
                  <SelectItem value="ellipsis">{t("overflowEllipsis")}</SelectItem>
                  <SelectItem value="fixed">{t("overflowFixed")}</SelectItem>
                </SelectContent>
              </Select>
              <PanelStepperInput
                ariaLabel={t("lineHeight")}
                decreaseLabel={t("decreaseLineHeight")}
                increaseLabel={t("increaseLineHeight")}
                value={numberAttr(node.attrs, "lineHeight", 1)}
                min={0.5}
                max={3}
                step={0.1}
                decimals={1}
                className="flex h-7 w-[8.5rem] shrink-0 items-stretch overflow-hidden border border-input/70 bg-muted/10"
                onChange={(value) => onChange({ lineHeight: value })}
              />
            </div>
          </div>
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

function createInitialHistory(sceneDocument: SceneDocument | null): SceneHistory {
  return sceneDocument ? { entries: [sceneDocument], index: 0 } : { entries: [], index: -1 };
}

function flushInlineTextEditingState({
  sceneDocument,
  history,
  editingTextNodeId,
  editingTextValue,
}: {
  sceneDocument: SceneDocument | null;
  history: SceneHistory;
  editingTextNodeId: string | null;
  editingTextValue: string;
}): {
  sceneDocument: SceneDocument | null;
  history: SceneHistory;
  didFlush: boolean;
} {
  if (!sceneDocument || !editingTextNodeId) {
    return { sceneDocument, history, didFlush: false };
  }

  const nextSceneDocument = updateSceneNodeAttrs(sceneDocument, editingTextNodeId, {
    text: editingTextValue,
  });

  return {
    sceneDocument: nextSceneDocument,
    history: pushHistoryEntry(history, nextSceneDocument),
    didFlush: true,
  };
}

function pushHistoryEntry(
  history: SceneHistory,
  sceneDocument: SceneDocument,
): SceneHistory {
  const current = history.entries[history.index];
  if (current && JSON.stringify(current) === JSON.stringify(sceneDocument)) {
    return history;
  }

  const entries = history.entries.slice(0, history.index + 1);
  entries.push(sceneDocument);
  const trimmedEntries =
    entries.length > MAX_HISTORY_ENTRIES
      ? entries.slice(entries.length - MAX_HISTORY_ENTRIES)
      : entries;

  return {
    entries: trimmedEntries,
    index: trimmedEntries.length - 1,
  };
}

function replaceCurrentHistoryEntry(
  history: SceneHistory,
  sceneDocument: SceneDocument,
): SceneHistory {
  if (history.index < 0) {
    return createInitialHistory(sceneDocument);
  }

  const entries = [...history.entries];
  entries[history.index] = sceneDocument;
  return { entries, index: history.index };
}

function getContentLayerChildren(sceneDocument: SceneDocument): SceneNode[] {
  return (
    sceneDocument.stage.children?.find((node) => node.className === "Layer")
      ?.children ?? []
  );
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

function removeSceneNode(
  sceneDocument: SceneDocument,
  nodeIdToRemove: string,
): SceneDocument {
  return {
    ...sceneDocument,
    stage: removeNodeFromTree(sceneDocument.stage, nodeIdToRemove),
  };
}

function removeNodeFromTree(node: SceneNode, nodeIdToRemove: string): SceneNode {
  if (!node.children) {
    return node;
  }

  return {
    ...node,
    children: node.children
      .filter((child) => stringAttr(child.attrs, "id") !== nodeIdToRemove)
      .map((child) => removeNodeFromTree(child, nodeIdToRemove)),
  };
}

function reorderContentLayerNode(
  sceneDocument: SceneDocument,
  draggedNodeId: string,
  targetNodeId: string,
  placement: "above" | "below",
): SceneDocument {
  let hasUpdated = false;
  const stageChildren = sceneDocument.stage.children?.map((child) => {
    if (hasUpdated || child.className !== "Layer") {
      return child;
    }

    const children = [...(child.children ?? [])];
    const draggedIndex = children.findIndex(
      (node) => stringAttr(node.attrs, "id") === draggedNodeId,
    );
    if (draggedIndex < 0 || isBackgroundNode(children[draggedIndex])) {
      return child;
    }

    const [draggedNode] = children.splice(draggedIndex, 1);
    if (!draggedNode) {
      return child;
    }

    const targetIndex = children.findIndex(
      (node) => stringAttr(node.attrs, "id") === targetNodeId,
    );
    if (targetIndex < 0) {
      return child;
    }

    const insertionIndex =
      placement === "above" ? targetIndex + 1 : targetIndex;
    children.splice(Math.max(insertionIndex, 1), 0, draggedNode);
    hasUpdated = true;
    return { ...child, children };
  });

  return stageChildren && hasUpdated
    ? { ...sceneDocument, stage: { ...sceneDocument.stage, children: stageChildren } }
    : sceneDocument;
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

function createFixedTextNode(
  sceneDocument: SceneDocument,
  nodeId: string,
  preset: TextPresetKind,
  point: { x: number; y: number },
  text: string,
): SceneNode {
  const stageWidth = numberAttr(sceneDocument.stage.attrs, "width", 1080);
  const stageHeight = numberAttr(sceneDocument.stage.attrs, "height", 1080);
  const style = TEXT_PRESET_STYLES[preset];
  const lineHeight = style.lineHeight ?? 1.2;
  const width = Math.max(
    estimateSingleLineTextWidth(text, style.fontSize),
    Math.round(stageWidth * 0.35),
  );
  const height = Math.round(style.fontSize * lineHeight);
  const x = point.x - Math.round(width / 2);
  const y = point.y - Math.round(height / 2);
  const minX = Math.min(0, stageWidth - width);
  const maxX = Math.max(0, stageWidth - width);
  const minY = Math.min(0, stageHeight - height);
  const maxY = Math.max(0, stageHeight - height);

  return {
    className: "Text",
    attrs: {
      id: nodeId,
      name: preset,
      x: Math.round(clamp(x, minX, maxX)),
      y: Math.round(clamp(y, minY, maxY)),
      width,
      height,
      text,
      fontSize: style.fontSize,
      fontFamily: "Arial",
      fontStyle: style.fontStyle ?? "normal",
      lineHeight,
      fill: "#111827",
      align: "center",
    },
  };
}

function parseTextPresetDragPayload(raw: string): TextPresetDragPayload | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<TextPresetDragPayload>;
    if (
      parsed.kind === "text-preset" &&
      (parsed.preset === "heading" ||
        parsed.preset === "subheading" ||
        parsed.preset === "body") &&
      typeof parsed.text === "string"
    ) {
      return {
        kind: "text-preset",
        preset: parsed.preset,
        text: parsed.text,
      };
    }
  } catch {
    return null;
  }

  return null;
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

function isLockedNode(node: SceneNode): boolean {
  return node.attrs.locked === true;
}

function getLayerLabel(node: SceneNode): string {
  return (
    stringAttr(node.attrs, "name") ??
    stringAttr(node.attrs, "text") ??
    getLayerBindingLabel(node) ??
    stringAttr(node.attrs, "id") ??
    node.className
  );
}

function getLayerBindingLabel(node: SceneNode): string | null {
  const bindingKey = stringAttr(node.attrs, "bindingKey");
  return bindingKey ?? null;
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

function isEditableShortcutTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();
  return (
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select" ||
    target.isContentEditable
  );
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

function getCssTextAlign(value: unknown): "left" | "center" | "right" | "justify" {
  return value === "center" || value === "right" || value === "justify"
    ? value
    : "left";
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
