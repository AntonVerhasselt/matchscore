# Template editor — react-konva implementation guide

> **Status:** Technical specification for the graphical template builder  
> **Related:** [Documentation/automations-and-templates.md](../Documentation/automations-and-templates.md), [automations-ui-navigation.md](./automations-ui-navigation.md)  
> **Stack:** Next.js 16, React 19, react-konva, Konva 10+, skia-canvas (server only), Convex Storage

This is the detailed blueprint for Matchscore's template editor: a **JSON-driven layout system** with a Canva-like UI, guaranteed pixel parity between browser preview and server-rendered PNG output.

---

## 1. Architectural foundation

### 1.1 The golden rule

**React state (serialized as Konva scene JSON) is the single source of truth.**

Do **not** treat Konva nodes as authoritative and sync back with `stage.toJSON()` on every frame. Do **not** imperatively mutate the scene graph outside React renders except for:

- Measurement (`node.getTextWidth()`, `getClientRect()`)
- Export preview (`stageRef.current.toDataURL()` — dev only)
- Transformer attachment (refs)

Konva's own [best practices](https://konvajs.org/docs/data_and_serialization/Best_Practices.html) explicitly recommend this for non-trivial apps: store minimal app state, render canvas from that state, push history snapshots on discrete actions.

### 1.2 Storage format (approved)

Per [automations-and-templates.md](../Documentation/automations-and-templates.md):

```ts
type SceneDocument = {
  schemaVersion: 1;
  stage: KonvaSerializedNode; // normalized tree from stage.toJSON()
};
```

Custom editor metadata (`bindingKey`, `assetId`, `objectFit`, `overflowMode`) lives in **node `attrs`** — Konva preserves unknown attrs through serialization.

**Why not a parallel custom Layer[] schema?** Matchscore already chose normalized Konva JSON because Konva v10+ renders the **same JSON** server-side via `import "konva/skia-backend"`. A custom schema would require maintaining a second renderer. Shared **pure functions** (object-fit math, text-fit, binding resolution) still apply — they compute Konva attrs, not a separate scene tree.

### 1.3 Runtime state split

Persist only `SceneDocument` to Convex. Keep ephemeral UI state in React:

```ts
interface EditorUiState {
  selectedNodeId: string | null;
  tool: "select" | "text" | "rect" | "image";
  previewMode: boolean;           // Phase 2+
  history: SceneDocument[];       // undo stack snapshots
  historyIndex: number;
  isDirty: boolean;
  editingTextNodeId: string | null;
}
```

Never persist: transformer state, guide lines, selection highlights, drag ghosts.

---

## 2. Dependencies

### 2.1 Install

```bash
pnpm add konva react-konva use-image
# Server render (Convex "use node" action only — NEVER import in client bundle):
pnpm add skia-canvas
```

Pin `konva` and `react-konva` to compatible versions (check react-konva peer deps). As of Konva 10+, Next.js integration is simpler than older versions.

### 2.2 Packages and roles

| Package | Where | Purpose |
|---------|-------|---------|
| `react-konva` | Client only | Declarative canvas |
| `konva` | Client + server action | Scene graph, serialization |
| `use-image` | Client | Hook to load images for `<Image />` |
| `skia-canvas` | Convex `"use node"` action | Native backend for Konva server render |

---

## 3. Next.js integration (critical)

### 3.1 Client-only rendering

react-konva is **browser-only**. On the server it renders an empty placeholder div. Every route that touches Konva must:

1. Live in a `"use client"` file under `components/`, **not** imported synchronously from server components.
2. Be loaded via `next/dynamic` with `{ ssr: false }`.

```tsx
// app/app/automations/[automationType]/[templateId]/page.tsx
"use client";

import dynamic from "next/dynamic";

export const TemplateEditorRoot = dynamic(
  () => import("@/components/template-editor/template-editor-root"),
  { ssr: false, loading: () => <TemplateEditorSkeleton /> },
);
```

**Important (Next.js 14+ gotcha):** Do not `import { Stage, Layer } from "react-konva"` in the **page file** even with `"use client"`. The dynamic import boundary must wrap the module that imports react-konva. Nested Konva components (`TemplateStage`, `EditorLayer`) must stay inside the dynamically loaded tree.

Reference: [react-konva Next.js README](https://github.com/konvajs/react-konva#usage-with-nextjs).

### 3.2 Konva 10+ and the `canvas` module error

If build fails with `Can't resolve 'canvas'`:

**Preferred (Konva ≥10):** Should work without config when using dynamic import.

**Fallback** — add to `next.config.ts`:

```ts
const nextConfig: NextConfig = {
  webpack: (config) => {
    config.externals = [...(config.externals ?? []), { canvas: "canvas" }];
    return config;
  },
};
```

Or Turbopack equivalent if the project switches bundlers.

**Never** import `konva/skia-backend` or `skia-canvas` in any client file. Keep server render code in `convex/automations/render.ts` (future) or `lib/template-scene/render-server.ts` marked `"use node"`.

### 3.3 React 19 considerations

- Use refs with `useRef<Konva.Stage>(null)` — unchanged from React 18.
- Strict Mode double-mounting: guard image loading and history init with cleanup in `useEffect`. Avoid creating duplicate global Konva listeners.
- Prefer `useCallback` / `useMemo` for event handlers passed to Konva nodes when they depend on large state slices (Konva re-attaches listeners on prop change).

---

## 4. Folder structure

```text
components/template-editor/
├── template-editor-root.tsx       # layout shell: toolbar, panels, canvas area
├── template-editor-skeleton.tsx
├── canvas/
│   ├── template-stage.tsx         # Stage + scale + resize observer
│   ├── scene-layer.tsx            # maps scene JSON → Konva nodes
│   ├── overlay-layer.tsx          # guides, safe zones (listening={false})
│   ├── selection-transformer.tsx  # Transformer + boundBoxFunc
│   ├── editable-text-overlay.tsx  # DOM textarea/contentEditable
│   └── nodes/
│       ├── scene-text.tsx
│       ├── scene-image.tsx
│       └── scene-rect.tsx
├── panels/
│   ├── layers-panel.tsx           # z-order, visibility, lock
│   ├── properties-panel.tsx       # position, typography, bindings
│   ├── assets-panel.tsx           # Convex storage library
│   └── bindings-panel.tsx         # variable picker (Phase 2)
├── toolbar/
│   ├── editor-toolbar.tsx
│   └── preset-toolbar.tsx         # canvas preset (read-only after create)
└── hooks/
    ├── use-editor-state.ts        # reducer for scene + UI state
    ├── use-scene-history.ts       # undo/redo snapshots
    ├── use-stage-scale.ts         # viewport fit
    ├── use-template-asset-url.ts  # Convex storage → signed URL
    └── use-text-fit.ts            # shrink-to-fit measurement

lib/template-scene/
├── index.ts
├── types.ts                       # SceneDocument, BindingKey, attrs extensions
├── canvas-presets.ts              # instagram_square → 1080×1080
├── placeholders.ts                # PLACEHOLDER_TEXT, PLACEHOLDER_IMAGES
├── normalize-scene-document.ts    # save pipeline
├── validate-scene-document.ts   # allowed classNames, attrs
├── hydrate-scene.ts               # load: resolve assetId → image, bindingKey → placeholder
├── resolve-binding.ts             # preview mode value resolution
├── calculate-object-fit.ts        # cover/contain crop rect (shared w/ server)
├── calculate-text-fit.ts          # binary search fontSize (shared w/ server)
└── adapt-layout-ratio.ts          # multi-ratio variant scaling (Phase 3)
```

---

## 5. Coordinate system & viewport

### 5.1 Fixed logical stage

**Always** set Stage `width` / `height` to the canvas preset dimensions (e.g. 1080×1080). **Never** resize the stage to the browser window.

Scale the entire stage to fit the container:

```tsx
function useStageScale(logicalWidth: number, logicalHeight: number) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      const s = Math.min(width / logicalWidth, height / logicalHeight, 1);
      setScale(s);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [logicalWidth, logicalHeight]);

  return { containerRef, scale, stagePixelWidth: logicalWidth, stagePixelHeight: logicalHeight };
}
```

```tsx
<div ref={containerRef} className="flex flex-1 items-center justify-center bg-[checkerboard]">
  <Stage
    width={stagePixelWidth}
    height={stagePixelHeight}
    scaleX={scale}
    scaleY={scale}
    ref={stageRef}
  >
    ...
  </Stage>
</div>
```

All persisted `x`, `y`, `width`, `height` values are **output pixels** — identical in editor and PNG export.

### 5.2 Pointer coordinate conversion

When mapping DOM overlay positions (text editor) or handling clicks with scale:

```ts
function getStagePointer(stage: Konva.Stage): { x: number; y: number } | null {
  const pos = stage.getPointerPosition();
  if (!pos) return null;
  const scale = stage.scaleX();
  return { x: pos.x / scale, y: pos.y / scale };
}
```

Use `node.getAbsoluteTransform().copy()` for overlay positioning per [Konva editable text demo](https://konvajs.org/docs/sandbox/Editable_Text.html).

---

## 6. Scene graph mapping

### 6.1 Allowed Konva nodes (MVP)

| className | Use |
|-----------|-----|
| `Stage` | Root (single) |
| `Layer` | Content layer + overlay layer |
| `Group` | Optional grouping |
| `Rect` | Blocks, overlays, gradients |
| `Text` | All typography |
| `Image` | Backgrounds, sponsors, bound logos |

**Do not use in MVP:** `Line`, `Circle`, filters (`blur`, `Brighten`), custom `sceneFunc`, `Konva.Path`, animation tweens, `cache()` unless profiling demands it.

### 6.2 Custom attrs convention

Extend Konva node attrs (stored in JSON):

```ts
interface TemplateNodeAttrs {
  // Identity (editor-only id — strip on save if regenerating)
  id?: string;

  // Static vs dynamic content
  assetId?: Id<"templateAssets">;     // Image: club upload
  bindingKey?: TextBindingKey | ImageBindingKey;

  // Layout helpers (not native Konva — interpreted by renderer)
  objectFit?: "cover" | "contain" | "fill";
  overflowMode?: "wrap" | "shrink" | "ellipsis" | "fixed";
  textTransform?: "none" | "uppercase";
  condition?: LayerCondition;         // Phase 4

  // Standard Konva attrs: x, y, width, height, fill, fontSize, etc.
}
```

### 6.3 Rendering loop

```tsx
function SceneLayer({ scene, ui, onSelect }: Props) {
  const contentLayer = scene.stage.children?.[0]; // convention: layer index 0 = content
  return (
    <Layer>
      {contentLayer?.children?.map((node) => (
        <SceneNode key={node.attrs.id} node={node} ui={ui} onSelect={onSelect} />
      ))}
      <SelectionTransformer selectedId={ui.selectedNodeId} />
    </Layer>
  );
}
```

Alternative: normalize to a flat `layers[]` array in editor memory for easier layer panel manipulation, then **denormalize to Konva tree on save**. Start with Konva tree directly for MVP simplicity; refactor if layer panel logic becomes painful.

---

## 7. Selection & Transformer

### 7.1 Pattern

```tsx
function SelectionTransformer({ selectedId }: { selectedId: string | null }) {
  const trRef = useRef<Konva.Transformer>(null);
  const stageRef = useContext(StageContext);

  useEffect(() => {
    const tr = trRef.current;
    const stage = stageRef.current;
    if (!tr || !stage || !selectedId) {
      tr?.nodes([]);
      return;
    }
    const node = stage.findOne(`#${selectedId}`);
    if (node) tr.nodes([node]);
    tr.getLayer()?.batchDraw();
  }, [selectedId, stageRef]);

  return (
    <Transformer
      ref={trRef}
      rotateEnabled
      enabledAnchors={[
        "top-left", "top-right", "bottom-left", "bottom-right",
        "middle-left", "middle-right", "top-center", "bottom-center",
      ]}
      boundBoxFunc={(oldBox, newBox) => {
        if (newBox.width < 10 || newBox.height < 10) return oldBox;
        return newBox;
      }}
      anchorSize={12}
      borderStroke="#0099ff"
    />
  );
}
```

### 7.2 Scale vs width/height (critical)

Konva Transformer changes `scaleX`/`scaleY`, **not** `width`/`height`. On `onTransformEnd`, bake scale into dimensions:

```ts
function bakeTransform(node: Konva.Node) {
  const scaleX = node.scaleX();
  const scaleY = node.scaleY();
  node.scaleX(1);
  node.scaleY(1);

  if (node.className === "Text") {
    const text = node as Konva.Text;
    text.width(Math.max(text.width() * scaleX, 30));
    // Text height auto from wrap
  } else {
    node.width(Math.max(node.width() * scaleX, 10));
    node.height(Math.max(node.height() * scaleY, 10));
  }
}
```

In react-konva, read values from the ref in `onTransformEnd`, compute new attrs, dispatch to reducer — **do not** leave scale ≠ 1 in persisted JSON.

### 7.3 Text-specific transformer

For text layers, restrict anchors to horizontal resize only (matches Konva editable text demo):

```tsx
<Transformer enabledAnchors={["middle-left", "middle-right"]} ... />
```

---

## 8. Text editing

### 8.1 Konva.Text is not editable

There is no built-in rich text or caret. Use a **DOM overlay** ([official demo](https://konvajs.org/docs/sandbox/Editable_Text.html)):

1. Double-click text node → set `editingTextNodeId`.
2. Hide Konva text + transformer temporarily.
3. Position `<textarea>` or `contentEditable` div using:
   - `node.absolutePosition()`
   - `stage.container().getBoundingClientRect()`
   - Stage `scaleX()` for font size and width
4. On blur / Enter (without Shift) → commit string to scene JSON, clear editing state.

Prefer `<textarea>` for MVP (simpler). Use `contentEditable` if you need multi-style rich text later (out of MVP scope).

### 8.2 Styles to sync

Match Konva attrs on the textarea:

- `fontSize`, `fontFamily`, `fontStyle`, `lineHeight`
- `color` from `fill`
- `textAlign` from `align`
- `transform: rotate(...)` from node rotation
- `letterSpacing` if used

### 8.3 Uppercase transform

Konva has no `textTransform`. Store `attrs.textTransform: "uppercase"` and apply when rendering:

```ts
function displayText(raw: string, attrs: TemplateNodeAttrs): string {
  const t = attrs.textTransform === "uppercase" ? raw.toUpperCase() : raw;
  return t;
}
```

Apply the same in server hydrate before setting Konva.Text `text`.

---

## 9. Images & Convex Storage

### 9.1 Loading in the browser

Use [`use-image`](https://konvajs.org/docs/react/Images.html):

```tsx
import useImage from "use-image";

function SceneImage({ src, crop, ...props }: SceneImageProps) {
  const [image, status] = useImage(src, "anonymous");
  if (status === "loading") return null; // or placeholder rect
  if (!image) return null;
  return <Image image={image} crop={crop} {...props} />;
}
```

### 9.2 Asset resolution pipeline

```ts
// Static upload
assetId → useQuery listTemplateAssets / getUrl → signed HTTPS URL → useImage

// Dynamic binding (editor)
bindingKey === "homeClubLogo" → PLACEHOLDER_IMAGES.homeClubLogo (bundled /public)

// Dynamic binding (server render — future)
bindingKey → fetch federation logo URL from match DTO → loadImage(buffer)
```

**Images are not in Konva JSON.** On save, persist only `assetId` or `bindingKey`. On load, hydrate images before drawing.

### 9.3 Object-fit (cover / contain)

Konva.Image has no CSS `object-fit`. Compute `crop` rectangle:

```ts
// lib/template-scene/calculate-object-fit.ts
export function calculateObjectFit(
  srcWidth: number,
  srcHeight: number,
  destWidth: number,
  destHeight: number,
  mode: "cover" | "contain" | "fill",
): { x: number; y: number; width: number; height: number } {
  // Pure math — identical in browser and skia-canvas server action
}
```

Pass result to `<Image crop={crop} width={destWidth} height={destHeight} />`.

Store `objectFit` in attrs; default backgrounds to `"cover"`.

### 9.4 CORS

Convex storage signed URLs must allow canvas read. If `use-image` taints canvas, ensure response headers permit cross-origin use or proxy through same-origin API route.

---

## 10. Text overflow modes

| Mode | Konva approach | Persist |
|------|----------------|---------|
| `wrap` | `width` + `wrap="word"` | `fontSize` fixed |
| `shrink` | Binary search `fontSize` until `getTextWidth()` ≤ box | computed `fontSize` on save OR store base + recompute on render |
| `ellipsis` | Truncate string + "…" via measurement loop | final `text` or algorithm params |
| `fixed` | Single line, may clip | — |

### 10.1 Shrink-to-fit algorithm

```ts
export function calculateTextFit(
  text: string,
  fontFamily: string,
  maxWidth: number,
  maxHeight: number,
  baseFontSize: number,
  measure: (text: string, fontSize: number) => { width: number; height: number },
): number {
  let lo = 8;
  let hi = baseFontSize;
  let best = lo;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const { width, height } = measure(text, mid);
    if (width <= maxWidth && height <= maxHeight) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return best;
}
```

**Browser measure:** hidden `Konva.Text` ref or `node.getTextWidth()` after setting attrs.

**Server measure:** same function with Konva.Text in skia backend.

**Default for bound team names:** `shrink`. Static headings: `wrap`.

---

## 11. Data binding & preview

### 11.1 Binding keys (MVP)

Per backend brief — store on node attrs, configure via property panel dropdown (not `{{mustache}}` in text).

**Text:** `homeClubName`, `awayClubName`, `matchAddress`, `matchDateTime`, `score`  
**Image:** `homeClubLogo`, `awayClubLogo`

Filter available keys by `automationType` (`score` only for `match_result`).

### 11.2 Resolver

```ts
function resolveTextContent(
  node: KonvaNodeJson,
  ctx: { previewMode: boolean; placeholders: PlaceholderMap; mockData?: MockData },
): string {
  const key = node.attrs.bindingKey as TextBindingKey | undefined;
  if (!key) return node.attrs.text ?? "";
  if (ctx.previewMode && ctx.mockData) return ctx.mockData[key] ?? PLACEHOLDER_TEXT[key];
  return PLACEHOLDER_TEXT[key];
}
```

Phase 1: always placeholders. Phase 2: `previewMode` toggle with richer mock fixture data.

### 11.3 Property panel UX (MVP)

For selected node:

1. **Inhoud** — Fixed text | Variable
2. If variable → binding dropdown (filtered by automation type)
3. Typography — font (from manifest), size, color, align, shadow
4. Overflow mode — for text
5. Object fit — for images

---

## 12. Layer panel

Maintain z-order as **array order** in the content Layer's `children`. Reorder via drag-and-drop in panel → immutable array splice → re-render.

Each row shows:

- Thumbnail/icon by type
- Name (`attrs.name` or generated)
- Lock toggle (`listening={false}` + skip drag when locked)
- Visibility toggle (`visible` attr)
- Chain-link badge when `bindingKey` set

Click row → `setSelectedNodeId`.

---

## 13. Overlay layer (non-persisted)

Second `<Layer listening={false}>`:

- Canvas center crosshairs (when dragging)
- Smart guide lines (Phase 3)
- Instagram safe zone dimming (bottom ~150px at 1080 width — scale proportionally)
- Watermark preview for Starter plan (Phase 4)

Never include overlay nodes in `normalizeSceneDocument`.

---

## 14. Save / load pipeline

### 14.1 Load (edit existing)

```ts
async function loadTemplate(templateId: Id<"automationTemplates">) {
  const template = await fetchQuery(api.automations.queries.getTemplate, { templateId });
  const scene = validateSceneDocument(template.sceneDocument);
  // Editor state initialized from scene
}
```

Hydration resolves images asynchronously — show loading skeleton until all `assetId` images fetched.

### 14.2 Save

```ts
function handleSave(stageRef: Konva.Stage, editorScene: SceneDocument) {
  const raw = stageRef.toObject(); // or use React state directly (preferred)
  const normalized = normalizeSceneDocument(raw);
  await mutate(api.automations.mutations.updateTemplate, {
    templateId,
    name,
    sceneDocument: normalized,
  });
  showSuccessToast(t("editor.saveSuccess"));
}
```

**Prefer saving from React state**, not `stage.toJSON()`, if React state is authoritative — they should match if rendering is fully controlled.

### 14.3 Normalizer responsibilities

1. Allowlist `className` values
2. Strip `draggable`, editor selection attrs
3. Validate `assetId` / `bindingKey` exclusivity on Image nodes
4. Bake any lingering `scaleX/Y` → width/height
5. Set `schemaVersion: 1`
6. Reject filters, custom sceneFunc

Implement in `lib/template-scene/normalize-scene-document.ts` — shared by client save and Convex mutation validator.

---

## 15. Undo / redo

Snapshot `SceneDocument` on **discrete actions** only:

- Drag end (`onDragEnd`)
- Transform end (`onTransformEnd`)
- Text commit (overlay blur)
- Layer reorder, add, delete
- Property panel change (debounce 300ms or commit on blur)

```ts
const MAX_HISTORY = 50;

function pushHistory(history: SceneDocument[], index: number, next: SceneDocument) {
  const truncated = history.slice(0, index + 1);
  const updated = [...truncated, structuredClone(next)].slice(-MAX_HISTORY);
  return { history: updated, index: updated.length - 1 };
}
```

Store history in refs if re-rendering the whole stack on every keystroke is costly; trigger React update only on undo/redo application.

Reference: [Konva React undo/redo demo](https://konvajs.org/docs/react/Undo-Redo.html).

---

## 16. Server render parity (skia-canvas)

### 16.1 Setup (Convex action)

```ts
"use node";

import Konva from "konva";
import "konva/skia-backend";
import { hydrateScene } from "@/lib/template-scene/hydrate-scene";

export async function renderTemplateToPng(sceneDocument: SceneDocument, match: MatchDto) {
  const stage = Konva.Node.create(sceneDocument.stage);
  stage.size({ width: preset.width, height: preset.height });

  await hydrateScene(stage, {
    resolveAsset: (assetId) => loadBufferFromConvexStorage(assetId),
    resolveBindingImage: (key) => loadMatchLogo(match, key),
    resolveBindingText: (key) => formatBinding(key, match, "nl-BE"),
  });

  const canvas = stage.toCanvas(); // skia backend
  return await canvas.toBuffer("png");
}
```

Reference: [Konva Node.js setup](https://konvajs.org/docs/nodejs/nodejs-setup), [skia-canvas](https://skia-canvas.org/).

### 16.2 Fonts

MVP: system fonts only (backend brief). Both environments must use the **same font family strings**:

- Browser: `-apple-system, BlinkMacSystemFont, "Segoe UI", ...` or named web-safe stacks
- skia-canvas: `registerFont()` when you add custom `.ttf` later

Document chosen fonts in `lib/template-scene/fonts.json` when custom fonts ship.

### 16.3 Parity checklist

| Feature | Shared module |
|---------|---------------|
| Object-fit crop | `calculate-object-fit.ts` |
| Shrink-to-fit | `calculate-text-fit.ts` |
| Binding text | `resolve-binding.ts` |
| Uppercase | `displayText()` |
| Date format | `formatBinding()` with `nl-BE` |
| Gradients | Same color stop arrays in attrs |

---

## 17. What NOT to use (MVP)

| Feature | Reason |
|---------|--------|
| `Konva.Filters.*` | Not in normalizer allowlist; skia parity risk |
| `stage.toJSON()` as live state | Use React-controlled attrs |
| Animations / `Konva.Tween` | Static templates only |
| `react-konva` Server Components | SSR empty; always dynamic import |
| Import `skia-canvas` client-side | Native module breaks browser bundle |
| Raw `{{mustache}}` in text | Error-prone for volunteers; use bindingKey |
| Multiple Stages | One stage per editor |
| `perfect-draw` disabled hacks | Only if profiling shows need |

---

## 18. Performance guidelines

1. **Single content Layer** for MVP — multiple layers are fine but avoid dozens.
2. **`listening={false}`** on overlay layer and locked nodes.
3. **Debounce** property panel numeric inputs; commit to history on blur.
4. **Image caching:** let browser cache signed URLs; don't reload on every render.
5. **Avoid `stage.draw()`** manually — react-konva batch draws on state update.
6. **Node count target:** < 30 nodes per template (MVP expectation).
7. **`batchDraw()`** only after bulk hydrate on load.

Konva performance doc was removed from site; general rule: minimize node count and disable hit graph on static backgrounds:

```tsx
<Image listening={false} image={bg} ... />
```

---

## 19. Editor UI layout

```text
┌──────────────────────────────────────────────────────────────────┐
│ ← Back   Template name   [Design|Preview]   [Undo][Redo] [Save] │
├──────────┬───────────────────────────────────────┬───────────────┤
│ Layers   │                                       │ Properties    │
│ Assets   │           Canvas (scaled Stage)       │ Bindings      │
│          │                                       │               │
└──────────┴───────────────────────────────────────┴───────────────┘
```

- **Left panel (240px):** tabs Layers | Assets
- **Center:** flex-1, checkerboard, resize observer
- **Right panel (280px):** context-sensitive inspector
- **Toolbar:** sticky top, full width

Use CSS grid on `template-editor-root.tsx`. Hide side panels on small screens with drawer toggles.

---

## 20. Implementation phases

### Phase 1 — Static editor (MVP core)

- [ ] `lib/template-scene/` types, presets, placeholders
- [ ] Stage + viewport scale
- [ ] Rect, Text, Image nodes from scene state
- [ ] Click select, drag, transformer resize/rotate
- [ ] DOM textarea text editing
- [ ] Layer panel (reorder, visibility)
- [ ] JSON export/import localStorage (dev)
- [ ] Save/load stub (console)

### Phase 2 — Data & assets

- [ ] Convex `templateAssets` upload + asset panel
- [ ] `assetId` hydration
- [ ] Binding dropdown + placeholders
- [ ] Preview mode toggle
- [ ] Persist via `createTemplate` / `updateTemplate`

### Phase 3 — Layout intelligence

- [ ] Smart guides + snapping (`onDragMove`)
- [ ] Text overflow modes
- [ ] Image object-fit
- [ ] Multi-ratio duplicate (`adaptLayoutRatio`)

### Phase 4 — Polish

- [ ] Conditional visibility UI
- [ ] Save validation (fonts, bindings, contrast warnings)
- [ ] Undo/redo keyboard shortcuts
- [ ] Server render action

---

## 21. Testing strategy

| Test | Method |
|------|--------|
| Object-fit math | Unit tests on `calculate-object-fit.ts` |
| Text-fit | Unit tests with mock measure function |
| Normalizer | Snapshot tests on fixture JSON |
| Render parity | Golden PNG compare: browser export vs skia action (Phase 4) |
| Next.js build | CI `pnpm build` catches `canvas` import leaks |

---

## 22. Common pitfalls summary

1. **Importing react-konva in page files** → `canvas` build error. Fix: dynamic import boundary in `components/`.
2. **Persisting scaleX/scaleY** → broken reload. Fix: bake on transform end.
3. **Stage sized to window** → export coordinate mismatch. Fix: fixed logical size + scale.
4. **Forgetting to hydrate images** → empty Image nodes on load.
5. **Serializing transformer/ guides** → corrupt templates. Fix: normalizer strips editor attrs.
6. **skia-canvas in client bundle** → native module crash. Fix: server-only import.
7. **Tainted canvas from CORS images** → export fails. Fix: CORS headers or proxy.
8. **Two sources of truth** (Konva imperative + React state) → desync. Fix: React state only, refs for measure.

---

## 23. Relationship to product UX vision

The detailed UX walkthrough (starter templates, aspect ratio toggle, smart guides, validation on save) from product design maps to the phases above. The approved backend stores **Konva JSON** rather than a custom layer schema — this guide preserves that decision while implementing the same user-facing capabilities through attrs conventions and shared math libraries.

When in doubt: **if it cannot be expressed in normalized Konva JSON + attrs, it cannot ship.**
