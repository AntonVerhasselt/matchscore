# Template editor

The template editor is a Canva-like visual designer for automation post templates. Clubs compose layouts on a fixed-size canvas; designs are stored as normalized Konva JSON and rendered to PNG on the server using the same format.

For product context, routes, and Convex APIs, see [automations-and-templates.md](./automations-and-templates.md).

---

## Core principle

**React state serialized as Konva scene JSON is the single source of truth.**

The editor does not treat live Konva nodes as authoritative or call `stage.toJSON()` on every frame. React holds the scene tree; react-konva renders it. Konva refs are used only for measurement, transformer attachment, and export.

Persist only `SceneDocument`. Keep selection, undo history, drag state, transformer handles, and text-editing overlays in React — they are stripped on save.

---

## Dependencies

| Package | Where | Purpose |
| --- | --- | --- |
| `konva`, `react-konva` | Client only (dynamic import) | Declarative canvas |
| `use-image` | Client | Load images for `<Image />` nodes |
| `skia-canvas` | Convex `"use node"` actions only | Native canvas backend for server render |

Install is already in `package.json`. **Never** import `skia-canvas` or `konva/skia-backend` in client code or default-runtime Convex files.

### Next.js boundary

Every module that imports `react-konva` must live inside the dynamically loaded editor tree:

```tsx
// app/app/automations/[automationType]/[templateId]/page.tsx
const TemplateEditorRoot = dynamic(
  () => import("@/components/template-editor/template-editor-root"),
  { ssr: false, loading: () => <TemplateEditorSkeleton /> },
);
```

The page file itself must not synchronously import `Stage`, `Layer`, or other Konva components.

---

## File layout

```text
components/template-editor/
  template-editor-root.tsx       # Shell, loading, mobile gate, back link
  template-editor-skeleton.tsx   # Dynamic import placeholder
  static-template-editor.tsx     # Main editor: canvas, panels, toolbar, state
  font-picker.tsx                # Searchable Google Fonts picker
  shapes-panel.tsx               # Shape preset insertion
  line-point-handles.tsx         # Start/end handles for Line nodes

hooks/
  use-template-autosave.ts       # 2.5 s idle debounced save

lib/template-scene/              # Shared pure TypeScript (client + server)
  index.ts                       # Types, normalization, bindings, object-fit, exports
  google-fonts.ts                # Curated font catalog + CDN loader
  text-style.ts                  # Bold/italic/underline helpers
  text-measure.ts                # Shrink + ellipsis measurement
  shape-presets.ts               # Insertable shape definitions
  line-points.ts                 # Line vertex normalization (2-point lines)
  format-binding.ts              # Server binding text (`nl-BE` dates)
  template-match.ts              # TemplateMatchDto
  mock-match.ts                  # DEFAULT_MOCK_MATCH fallback
  prepare-render-node.ts         # Text/image layout prep for server
  placeholder-crest.ts           # SVG crest placeholders (editor)
  server-font-registry.ts        # Catalog → HTTPS font URLs
  server-font-manifest.generated.ts  # Generated manifest (commit this)

convex/automations/render/       # "use node" only
  register_scene_fonts.ts        # Download + FontLibrary.use
  load_placeholder_crest.ts      # SVG → PNG for server Konva
  hydrate_scene.ts               # Asset + binding hydration
  render_template_to_png.ts        # Orchestrates PNG export
```

---

## Scene document format

Stored on `automationTemplates.sceneDocument`:

```ts
type SceneDocument = {
  schemaVersion: 1;
  stage: SceneNode;
};

type SceneNode = {
  className: SceneNodeClassName;
  attrs: Record<string, unknown>;
  children?: SceneNode[];
};
```

Both the template row field `schemaVersion` and `sceneDocument.schemaVersion` must be `1`.

### Allowed node classes

| `className` | Use |
| --- | --- |
| `Stage` | Root (single stage per template) |
| `Layer` | Content layer |
| `Group` | Optional grouping |
| `Rect` | Blocks, color backgrounds |
| `Circle`, `RegularPolygon`, `Star` | Shape presets |
| `Line`, `Arrow` | Lines and arrows (2 vertex points) |
| `Text` | Typography |
| `Image` | Static uploads or dynamic logo bindings |

Rejected on save: filters, custom `sceneFunc`, `Path`, animations, unsupported classes.

### Custom attrs

Editor metadata lives in Konva `attrs` (unknown attrs survive serialization):

| Attr | Applies to | Purpose |
| --- | --- | --- |
| `id` | All | Stable node id for selection |
| `name` | All | Layer panel label |
| `assetId` | `Image` | Static upload (`Id<"templateAssets">`) |
| `bindingKey` | `Text`, `Image` | Dynamic match variable |
| `objectFit` | `Image` | `cover`, `contain`, or `fill` |
| `overflowMode` | `Text` | `wrap`, `shrink`, `ellipsis`, `fixed` |
| `textTransform` | `Text` | `none` or `uppercase` |
| `visible` | All | Hide in editor and render |
| `locked` | All | Prevent drag/transform in editor |

`Image` nodes must have **either** `assetId` **or** an image `bindingKey`, not both. Dynamic `Text` nodes use `bindingKey` instead of static `text`.

Editor-only attrs (`draggable`, `listening`, selection flags, guide metadata) are stripped on save.

---

## Canvas presets & coordinates

The stage always uses logical output pixels matching the preset:

| Preset | Width × height |
| --- | --- |
| `instagram_square` | 1080 × 1080 |
| `instagram_portrait` | 1080 × 1350 |
| `facebook_landscape` | 1200 × 630 |

The stage is **not** resized to the browser window. A `ResizeObserver` scales the stage visually to fit its container; persisted `x`, `y`, `width`, and `height` values are output pixels identical in editor and exported PNG.

On transform end, Konva `scaleX`/`scaleY` are baked into width/height and reset to `1` before save.

---

## Variable bindings

Users never type template syntax manually. The property panel offers **Inhoud** → fixed text or variable → binding dropdown.

### Text bindings

| `bindingKey` | Automation types | Design-mode display | Preview-mode display |
| --- | --- | --- | --- |
| `homeClubName` | both | `{{ homeClubName }}` | Linked match home team name |
| `awayClubName` | both | `{{ awayClubName }}` | Linked match away team name |
| `homeAwayClubNames` | both | `{{ homeClubName }} - {{ awayClubName }}` | `Home - Away` from synced match |
| `matchAddress` | both | `{{ matchAddress }}` | Home team imported address |
| `matchDateTime` | both | `{{ matchDateTime }}` | `kickoffAt` formatted `nl-BE` |
| `score` | `match_result` only | `{{ score }}` | Goals or `resultText` if non-standard status |

`score` is rejected for `match_announcement` templates at validation time.

### Image bindings

| `bindingKey` | Design mode | Preview mode | Server render |
| --- | --- | --- | --- |
| `homeClubLogo` | SVG crest placeholder | Signed URL from `footballTeams.logoStorageId` | PNG from Convex storage |
| `awayClubLogo` | SVG crest placeholder | Signed URL from `footballTeams.logoStorageId` | PNG from Convex storage |

Missing logo: empty/transparent box (no crest fallback on server or in preview).

### Preview modes

The toolbar toggles **Design** vs **Preview**:

- **Design** — token-like placeholders for bound text; generic crests for logos.
- **Preview** — resolves bindings from `football.queries.getTemplateRenderMatchData` via `PreviewMatchProvider`. Sample match rules match the render test (announcement → next future or latest past; result → latest played). Falls back to static mock strings only when no synced match exists.

Toggling to Preview refreshes the sample timestamp so the query picks the current next/latest fixture.

The saved scene always stores `bindingKey`, never resolved URLs or display strings for dynamic content.

---

## Normalization pipeline

Every save runs through `normalizeSceneDocument(raw, canvasPreset, automationType)` in `lib/template-scene/index.ts`. The same function runs client-side before mutations and server-side in `updateTemplate` and render actions.

Responsibilities:

1. Require `schemaVersion: 1` and root `Stage`.
2. Validate stage dimensions match the canvas preset.
3. Allowlist node classes; reject filters and custom scene functions.
4. Strip editor-only attrs.
5. Validate binding keys per automation type and node class.
6. Enforce `assetId` / `bindingKey` exclusivity on images.
7. Normalize line nodes to exactly two points (`line-points.ts`).
8. Bake lingering scale into width/height.

Client validation improves UX; server validation is authoritative.

---

## Editor features

### Layout

`static-template-editor.tsx` implements the full editor in one module:

- **Toolbar** — back link, template name, design/preview toggle, undo/redo, save status, render test, manual save.
- **Left panel tabs** — Layers, Assets, Text, Shapes, Background.
- **Center** — scaled Konva stage with transformer and line endpoint handles.
- **Right panel** — context-sensitive properties for the selected node.

### Text editing

- Double-click **fixed** text opens a DOM `<textarea>` overlay positioned with the node's absolute transform.
- Variable text is edited via the binding dropdown only (double-click does not convert to fixed text).
- Inline edits flush into the scene before undo, redo, or save.

Typography controls: searchable font picker (~50 Google Fonts + system fonts), size/line-height steppers, color row, bold/italic/underline/uppercase, alignment, overflow mode.

### Layers panel

- Z-order follows child array order in the content layer.
- Drag reorder, visibility toggle, lock toggle, delete (non-background nodes).
- Background node (`id: "background"`) is managed via the Background tab.

### Shapes panel

17 presets across rects, circles, polygons, stars, lines, and arrows. Insert via drag onto canvas, click, or keyboard (Enter/Space at center).

### Assets panel

Upload PNG/JPEG/WebP (max 8 MB) → Convex Storage → drag onto canvas as `Image` nodes with intrinsic dimensions. Delete is blocked while referenced.

### Background tab

- Color: full-canvas `Rect` with editable fill.
- Image: bottom `Image` node with `id: "background"` and `assetId`, default `objectFit: cover`.
- Selecting the background opens this tab instead of generic properties.

### History & shortcuts

- Undo/redo stack (max 50 snapshots) on discrete actions: drag end, transform end, text commit, reorder, add/delete, property changes.
- **Delete/Backspace** — delete selected non-background node.
- **Cmd/Ctrl+Z / Shift+Z / Y** — undo/redo.
- **Cmd/Ctrl+S** — manual save with toast.

### Autosave

`useTemplateAutosave` debounces save by **2500 ms** after the last change while dirty. Toolbar shows saving / unsaved / saved. `beforeunload` warns on unsaved edits.

---

## Static images & object fit

Konva does not support CSS `object-fit`. Both editor and server use `calculateObjectFit()` in `lib/template-scene/index.ts` to compute `crop` and render rectangles.

| Mode | Behavior |
| --- | --- |
| `cover` | Fill box, crop overflow (default for backgrounds) |
| `contain` | Fit entire image inside box |
| `fill` | Stretch to box |

Hydration path:

```
assetId → signed Convex Storage URL → useImage (browser) / ctx.storage.get (server)
bindingKey → placeholder crest (editor) / rasterized crest PNG (server)
```

Images are never embedded in scene JSON — only references.

---

## Text overflow

| Mode | Behavior |
| --- | --- |
| `wrap` | Fixed font size, word wrap inside width |
| `shrink` | Binary search font size until content fits (`calculateTextFit`) |
| `ellipsis` | Truncate with ellipsis (`ellipsizeText`) |
| `fixed` | Single line; may clip |

Shared measurement helpers live in `lib/template-scene/text-measure.ts` and are used by both editor and server render prep.

---

## Fonts

### Browser editor

Curated Google Fonts catalog in `lib/template-scene/google-fonts.ts`. `loadGoogleFonts()` injects a Google Fonts CSS stylesheet for families used in the current scene. System fonts (Arial, Times New Roman, etc.) are available in the picker.

### Server render

Linux Convex Node lacks system fonts. The server:

1. Collects font families from the scene via `collectSceneFontFamilies`.
2. Maps system families to metric-compatible Google Font stand-ins (Arial → Arimo, Times/Georgia → Tinos, Verdana → Open Sans).
3. Downloads `.woff2` files from URLs in `server-font-manifest.generated.ts` to `os.tmpdir()`.
4. Registers fonts with skia-canvas `FontLibrary.use()` before `Konva.Node.create`.

Regenerate the manifest when the catalog changes:

```bash
pnpm sync-template-fonts
```

**Limitation:** Bold/italic weight file selection is not fully mapped per family; minor text metric drift between Chrome and skia-canvas is expected. Wrong font family is not acceptable.

Club-uploaded custom font files are not supported.

---

## Server render pipeline

Entry point: `convex/automations/actions.ts` → `renderTemplateTest`.

```
normalizeSceneDocument
  → registerSceneFonts (download + FontLibrary.use)
  → createPreparedStageJson (binding text via formatBinding, text-fit, image layout)
  → Konva.Node.create + hydrateKonvaStage (template assets + team logos from storage)
  → stage.toDataURL → PNG buffer
  → ctx.storage.store
  → replaceTemplateRenderPreview (delete previous preview blob)
  → return signed previewUrl
```

`renderTemplateTest` loads a sample match through `getTemplateRenderMatchData` (same as editor Preview). Falls back to `DEFAULT_MOCK_MATCH` when the org has no suitable synced fixture. Uses `formatBinding()` with `nl-BE` locale for dates.

Technology stack in render files:

```ts
import Konva from "konva";
import "konva/skia-backend";
```

`skia-canvas` is listed in `convex.json` `node.externalPackages`.

Internal `renderSpikeTest` action renders a trivial solid-color PNG to verify native module compatibility on Convex.

### Production posting (future)

Posting will load the saved template by id (no canvas override), resolve bindings from the same `TemplateRenderMatchData` pipeline for the triggered fixture, render, and hand off to social APIs. Cron wiring and internal unauthenticated query variants are not built yet.

---

## Shared parity modules

Browser editor and server render share these implementations:

| Concern | Module |
| --- | --- |
| Object fit | `calculateObjectFit` in `lib/template-scene/index.ts` |
| Shrink-to-fit | `calculateTextFit`, `measureTextForFit` |
| Ellipsis | `ellipsizeText` |
| Binding text (server) | `formatBinding`, `formatMatchDateTime` |
| Uppercase | `displayText` / `textTransform` attr |
| Shape stroke prep | `prepareFilledShapeAttrsForRender` |
| Line normalization | `normalizeLinePoints` |

---

## Testing

| Test file | Coverage |
| --- | --- |
| `convex/automations/scenes.test.ts` | Normalization, bindings, shapes, text styles, text fit |
| `convex/automations/render/render.test.ts` | Font registration, per-node fonts, crest pixel checks |

Local smoke test (requires skia-canvas installed):

```bash
pnpm test:template-render
```

CI `pnpm build` catches accidental `canvas` / `skia-canvas` imports in the client bundle.

---

## Known limitations

- Editor requires desktop viewport (≥ 1024px width).
- Render test hits `fonts.gstatic.com` on first use of each font family (cold-start latency).
- Render preview blobs accumulate one per template (`lastRenderPreviewStorageId`); old blobs are replaced, not orphaned.
- Template list shows a placeholder thumbnail box (no generated preview image yet).
- No overlay guide layer (center crosshair / safe zones).
- Property panel numeric fields commit on each change (autosave debounces the save, not keystrokes).
- Pixel-perfect text parity between Chrome and skia-canvas is not guaranteed.
- SVG images loaded directly in server Konva with crop can fail; crest placeholders are rasterized to PNG first.

---

## Related documentation

- [automations-and-templates.md](./automations-and-templates.md) — Product overview, data model, routes, API
- [Konva best practices](https://konvajs.org/docs/data_and_serialization/Best_Practices.html)
- [react-konva Next.js usage](https://github.com/konvajs/react-konva#usage-with-nextjs)
