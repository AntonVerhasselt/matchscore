# Automations and Template Editor - Phased Implementation Plan

> Status: combined implementation specification  
> Sources: `Documentation/automations-and-templates.md`, `plan/template-editor-react-konva.md`  
> Branch context: `feature/club-automations-templates`  
> Scope: Convex database design, automation/template APIs, react-konva editor, storage conventions, server render foundation, and phase-by-phase testing.  
> Non-scope for MVP: match/calendar storage, actual scheduled posting, Meta/social posting, subscription/watermark enforcement, and `starting_eleven`.
> Current implementation status: Phases 1-6 are merged to `main` (Phase 6 via PR #15). Phase 7 is implemented on `templates-phase-7` (uncommitted at time of writing) and is ready for manual handoff testing. Post-MVP deferred items (match data, posting, social OAuth, etc.) remain out of scope.

This document combines the approved product/backend brief and the react-konva technical guide into one phased implementation plan. Each phase must produce a small integrated slice: backend state, frontend UI, automated checks, browser verification, and database verification. After a phase passes those checks, the implementer should stop and hand it to the user for manual testing before continuing.

## Implementation Contract

Each phase follows the same delivery loop:

1. Implement the backend and frontend scope for that phase only.
2. Run the relevant code tests and type/lint/build checks.
3. Open the browser and verify the user flow manually.
4. Verify the database state changed exactly as expected.
5. If anything fails, continue fixing inside the same phase.
6. Only when the phase passes, report the result to the user and ask them to test.

The first phase must be intentionally small: it should have almost no editor functionality, but it must prove the data model, authentication/org scoping, route wiring, UI interaction, and database writes are real.

## Product Context

Matchscore automates social media for Belgian amateur football clubs. In user-facing copy we say "club"; in code and database schema we use `organization`.

Each organization can:

- Design visual templates for automated posts.
- Toggle automations on or off per post type.
- Later connect social accounts so Matchscore can select a template, fill variables, render an image, and post it.

MVP automation types:

| Type | Future trigger | Purpose |
| --- | --- | --- |
| `match_announcement` | 2 days before kick-off | Opponent, location, date/time |
| `match_result` | When federation publishes result | Final score visual |

Deferred automation type:

- `starting_eleven`

Deferred product areas:

- Match/calendar tables.
- Render scheduling.
- Meta/social posting.
- Subscription gating and watermark behavior.
- Full live preview with real fixture data.
- Email nudges.
- Thumbnails, unless a later phase explicitly chooses to add them.

## Approved Decisions

These decisions are carried forward unchanged:

| Topic | Decision |
| --- | --- |
| MVP automation types | `match_announcement`, `match_result` only |
| Initial automation state | Globally active, with all MVP posting channels active, when an organization is created |
| Enable rule | Users can toggle global automation state and per-channel posting freely; no template is required to keep an automation active |
| Enabled with zero templates | Valid state; future posting job skips that automation type |
| Active-but-no-template nudge | Deferred email reminder |
| Template selection at post time | Uniform random among templates |
| Subscription lapse | Block posting only; editing remains allowed |
| Canvas dimensions | Fixed presets |
| Static images | Stored as `templateAssets` and referenced by `assetId` |
| Static image upload types | PNG, JPG/JPEG, and WebP only for MVP |
| Dynamic images | Club logos resolved at render time from match data; placeholders in editor |
| Home/away wording | Variables are match-relative: `homeClubLogo`, not "our logo" |
| Date/time format | `nl-BE` |
| Variable UX | Property panel binding dropdown, not `{{mustache}}` text |
| Live preview MVP | Static placeholder values first |
| Template limit | None |
| Version history | None; overwrite on save |
| Permissions | Any organization member can manage automations and templates |
| Watermark | Out of scope |
| Scene storage | Inline `sceneDocument` object on template row |
| Fonts | System fonts plus a curated Google Fonts catalog in the editor (Phase 5); server render registers the same catalog via downloaded `.woff2` files in Phase 6 (see **Google Fonts — server render strategy**). System fonts are mapped to metric-compatible Google Font stand-ins on Linux. Club-uploaded custom fonts remain deferred. |
| Konva features | Basic `Stage`, `Layer`, `Group`, `Rect`, `Text`, `Image` only |
| Schema versioning | `schemaVersion: 1` on every template |
| Render backend | **Approved:** `konva/skia-backend` + `skia-canvas` in Convex `"use node"` actions. Fallback to `konva/canvas-backend` + `canvas` only if the Convex native-module spike fails. |
| Thumbnail | Optional `thumbnailStorageId`, implement later |
| Delete templates | Hard delete |
| Background editing | A dedicated Background tab controls background color/image; background selection opens this tab |
| Organization deletion | Delete child automation/template/asset rows when org deletion exists |

## Architecture Summary

The core architecture is:

- React state serialized as normalized Konva scene JSON is the single source of truth.
- The frontend editor uses `react-konva`.
- The backend stores the normalized scene JSON inline on `automationTemplates`.
- The future server renderer uses the same scene JSON with Konva 10+ and `konva/skia-backend`.
- Static uploaded images live in Convex Storage and are referenced through `templateAssets`.
- Dynamic content uses `bindingKey` attrs on Konva nodes.

The key discovery from the research is that Konva v10+ has an explicit skia backend:

```ts
import Konva from "konva";
import "konva/skia-backend";
```

That means the same normalized Konva scene JSON can be edited in the browser and rendered server-side without a custom Canvas 2D translator. A custom schema and dual-storage approach are rejected for the MVP because they introduce a second renderer or two sources of truth.

## Data Model

The database relationship is:

```text
organizations
  -> organizationAutomations
  -> automationTemplates
  -> templateAssets
```

### `organizationAutomations`

One row per organization per automation type.

```ts
organizationAutomations: defineTable({
  organizationId: v.id("organizations"),
  automationType: v.union(
    v.literal("match_announcement"),
    v.literal("match_result"),
  ),
  isGloballyEnabled: v.boolean(),
  postingChannels: v.object({
    facebookPagePost: v.boolean(),
    facebookPageStory: v.boolean(),
    instagramProfilePost: v.boolean(),
    instagramProfileStory: v.boolean(),
  }),
  updatedAt: v.number(),
  updatedByUserId: v.optional(v.string()),
})
  .index("by_organizationId", ["organizationId"])
  .index("by_organizationId_and_automationType", [
    "organizationId",
    "automationType",
  ]);
```

Invariants:

- Exactly two rows per organization for MVP.
- Rows are created when the organization is created.
- Existing organizations need a one-time backfill or an idempotent `ensureOrganizationAutomations` path during Phase 1.
- `isGloballyEnabled` defaults to `true`.
- All MVP `postingChannels` default to `true`.
- Global and per-channel toggling is always allowed.
- No template count check on enable.
- Deleting the last template does not disable the automation.
- Future posting skips automation types that are globally enabled but have zero templates.
- When `isGloballyEnabled` is false, UI-derived effective posting channel status is false for every channel, while stored per-channel preferences remain available for later re-enable.

### `automationTemplates`

Templates are stored per organization and automation type.

```ts
automationTemplates: defineTable({
  organizationId: v.id("organizations"),
  automationType: v.union(
    v.literal("match_announcement"),
    v.literal("match_result"),
  ),
  name: v.string(),
  sceneDocument: v.any(),
  canvasPreset: v.union(
    v.literal("instagram_square"),
    v.literal("instagram_portrait"),
    v.literal("facebook_landscape"),
  ),
  schemaVersion: v.number(),
  thumbnailStorageId: v.optional(v.id("_storage")),
  createdByUserId: v.string(),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_organizationId", ["organizationId"])
  .index("by_organizationId_and_automationType", [
    "organizationId",
    "automationType",
  ]);
```

Canvas presets:

| Key | Size | Typical use |
| --- | --- | --- |
| `instagram_square` | 1080 x 1080 | Instagram feed, Facebook square posts |
| `instagram_portrait` | 1080 x 1350 | Instagram portrait |
| `facebook_landscape` | 1200 x 630 | Facebook landscape/link-style visual |

Rules:

- Store only `canvasPreset`; derive width and height in code.
- `automationType` should be immutable after creation.
- `schemaVersion` starts at `1`.
- `sceneDocument` is stored as a parsed object, not a JSON string.
- `thumbnailStorageId` is optional and can remain unused until thumbnails are implemented.
- Inline `sceneDocument` is acceptable for MVP because templates should be well under Convex's document size limit.
- If real templates approach the 1 MB document limit, revisit storing JSON in `_storage`.

### `templateAssets`

Static files uploaded by a club, such as backgrounds and sponsor logos.

```ts
templateAssets: defineTable({
  organizationId: v.id("organizations"),
  storageId: v.id("_storage"),
  fileName: v.string(),
  mimeType: v.string(),
  byteSize: v.number(),
  pixelWidth: v.optional(v.number()),
  pixelHeight: v.optional(v.number()),
  uploadedByUserId: v.string(),
  createdAt: v.number(),
})
  .index("by_organizationId", ["organizationId"])
  .index("by_storageId", ["storageId"]);
```

Rules:

- Store static club uploads here.
- Store durable Convex Storage IDs and metadata, not signed URLs.
- Generate signed URLs at read time through `ctx.storage.getUrl(storageId)`.
- Store intrinsic image dimensions when available so inserted image nodes can preserve original dimensions.
- Accept only `image/png`, `image/jpeg`, and `image/webp` for MVP, with an 8 MB limit.
- Do not store home/away club logos here for MVP; those are dynamic image bindings resolved from match data at render time.
- Deleting an asset should reject if any template references it through `attrs.assetId`.
- A later background integrity job can clean orphaned assets, but Phase 4 should at least prevent deleting referenced assets.

## Convex API Surface

Follow the repository's Convex folder conventions. The source brief expects `convex/automations/` and `convex/templateAssets/`.

All public functions must:

- Validate arguments.
- Validate returns where the project pattern supports return validators.
- Authenticate server-side.
- Resolve the current organization from membership.
- Never accept a `userId` or organization owner id from the client for authorization.
- Scope reads and writes to `membership.organizationId`.
- Use indexes rather than table scans.
- Keep query/mutation wrappers thin and move shared logic into helper functions when useful.
- Show success/error feedback in the UI with Sonner via `@/lib/user-feedback` after user actions.

Automation queries:

| Function | Purpose |
| --- | --- |
| `listAutomations` | Return both automation rows for current organization plus global state, per-channel state, effective channel state, and template count per type |
| `listTemplates` | Return templates for current organization, optionally filtered by automation type |
| `getTemplate` | Return one template by id if it belongs to the current organization |

Automation mutations:

| Function | Purpose |
| --- | --- |
| `setAutomationGlobalEnabled` | Set `isGloballyEnabled`; no template count check |
| `setAutomationPostingChannelEnabled` | Set one stored posting channel preference; no template count check |
| `createTemplate` | Validate scene document and insert template |
| `updateTemplate` | Validate scene document and update name/scene; reject `assetId` references outside the current organization |
| `deleteTemplate` | Hard delete; do not change automation state |

Template asset functions:

| Function | Purpose |
| --- | --- |
| `generateUploadUrl` | Return Convex Storage upload URL |
| `saveTemplateAsset` | Insert asset metadata after upload, including intrinsic dimensions when supplied by the client |
| `listTemplateAssets` | List current organization's assets with generated signed URLs |
| `deleteTemplateAsset` | Reject if referenced; otherwise delete row and storage blob if supported |

## Scene Document Format

Persist this top-level structure:

```ts
type SceneDocument = {
  schemaVersion: 1;
  stage: KonvaSerializedNode;
};
```

`stage` follows Konva's serialized tree:

```ts
type KonvaSerializedNode = {
  className: string;
  attrs: Record<string, unknown>;
  children?: KonvaSerializedNode[];
};
```

Custom editor metadata lives in `attrs`. Konva preserves unknown attrs through serialization.

Important attrs:

```ts
interface TemplateNodeAttrs {
  id?: string;
  name?: string;
  assetId?: Id<"templateAssets">;
  bindingKey?: TextBindingKey | ImageBindingKey;
  objectFit?: "cover" | "contain" | "fill";
  overflowMode?: "wrap" | "shrink" | "ellipsis" | "fixed";
  textTransform?: "none" | "uppercase";
  condition?: LayerCondition; // future
}
```

Allowed node classes for MVP:

| `className` | Use |
| --- | --- |
| `Stage` | Root |
| `Layer` | Content layer |
| `Group` | Optional grouping |
| `Rect` | Blocks, overlays, background shapes |
| `Text` | Typography |
| `Image` | Backgrounds, sponsors, bound logos |

Do not use in MVP:

- `Line`
- `Circle`
- `Path`
- filters
- custom `sceneFunc`
- animations
- `Konva.Tween`
- multiple stages
- `cache()` unless profiling proves it is necessary

### Binding Keys

Text bindings:

| `bindingKey` | Automation types | Placeholder |
| --- | --- | --- |
| `homeClubName` | both | `Thuisploeg` |
| `awayClubName` | both | `Uitploeg` |
| `homeAwayClubNames` | both | `Thuisploeg - Uitploeg` |
| `matchAddress` | both | `Adres van de wedstrijd` |
| `matchDateTime` | both | `za 15 mrt. 2025, 20:00` |
| `score` | `match_result` only | `2 - 1` |

Image bindings:

| `bindingKey` | Automation types | Editor placeholder |
| --- | --- | --- |
| `homeClubLogo` | both | bundled generic crest |
| `awayClubLogo` | both | bundled generic crest |

Rules:

- Dynamic text and image content is represented by `attrs.bindingKey`.
- Static image content is represented by `attrs.assetId`.
- Users must never type `{{mustache}}` syntax manually. The editor may show token-like design placeholders for bound values, but the persisted source of truth is always `attrs.bindingKey`.
- The property panel should show "Inhoud" for editable content. In Phase 3, text nodes support fixed text versus variable text bindings, and dynamic logo `Image` nodes support variable image bindings. Fixed/static uploaded image content remains Phase 4.
- Binding dropdown options must be filtered by automation type.
- `score` is invalid for `match_announcement`.

### Normalization on Save

Every save must run through `normalizeSceneDocument`.

Responsibilities:

1. Parse raw JSON if needed.
2. Ensure top-level `schemaVersion: 1`.
3. Ensure root class is `Stage`.
4. Validate allowed `className` values.
5. Strip editor-only attrs such as `draggable`, transformer metadata, selection state, guide metadata, and temporary UI flags.
6. Reject filters, custom `sceneFunc`, unknown classes, and unsupported shapes.
7. Ensure `Image` nodes have exactly one of `assetId` or image `bindingKey` when they require external content.
8. Ensure dynamic `Text` nodes have valid text `bindingKey`.
9. Bake any lingering `scaleX` and `scaleY` into width/height.
10. Keep persisted coordinates as output pixels.
11. Keep only the content layer, not overlay guides or transformer nodes.

The same validation rules should run client-side before calling mutations and server-side inside Convex mutations. Client validation is UX; server validation is authority.

### Hydration on Load

Images are not stored in Konva JSON. On load:

- Static `assetId` resolves to a signed Convex Storage URL.
- Dynamic logo `bindingKey` resolves to a bundled placeholder image in the editor.
- Dynamic text `bindingKey` resolves to placeholder text or preview mock data.
- Server rendering later resolves asset IDs from Convex Storage and dynamic bindings from match data.

## Frontend Architecture

The editor must be client-only where it imports `react-konva`.

Next.js integration rules:

- Keep `react-konva` imports inside dynamically imported components.
- Do not synchronously import `Stage`, `Layer`, or other Konva components from app route files.
- Use `next/dynamic` with `{ ssr: false }`.
- Never import `konva/skia-backend` or `skia-canvas` in client files.
- If a build fails with `Can't resolve 'canvas'`, first confirm the dynamic import boundary is correct. Only then use the existing fallback pattern in `next.config.ts`.

Dependency intent:

```bash
pnpm add konva react-konva use-image
pnpm add skia-canvas  # Convex "use node" render actions only — must not enter the client bundle
```

### Runtime State Split

Persist only `SceneDocument`. Keep UI state in React.

```ts
interface EditorUiState {
  selectedNodeId: string | null;
  tool: "select" | "text" | "rect" | "image";
  previewMode: boolean;
  history: SceneDocument[];
  historyIndex: number;
  isDirty: boolean;
  editingTextNodeId: string | null;
}
```

Never persist:

- Transformer state.
- Guide lines.
- Selection highlights.
- Drag ghosts.
- Overlay layer nodes.
- Local history.

React state is authoritative. Do not treat the live Konva node tree as the source of truth. Refs can be used for measurement, exporting a dev preview, and transformer attachment.

### Coordinate System

The stage always uses the logical canvas preset size:

- `instagram_square`: 1080 x 1080
- `instagram_portrait`: 1080 x 1350
- `facebook_landscape`: 1200 x 630

Do not resize the stage to the browser window. Scale the stage visually to fit its container. Persisted `x`, `y`, `width`, and `height` values are output pixels and must match final PNG coordinates.

### Suggested Folder Structure

```text
components/template-editor/
  template-editor-root.tsx
  template-editor-skeleton.tsx
  canvas/
    template-stage.tsx
    scene-layer.tsx
    overlay-layer.tsx
    selection-transformer.tsx
    editable-text-overlay.tsx
    nodes/
      scene-text.tsx
      scene-image.tsx
      scene-rect.tsx
  panels/
    layers-panel.tsx
    properties-panel.tsx
    assets-panel.tsx
    bindings-panel.tsx
  toolbar/
    editor-toolbar.tsx
    preset-toolbar.tsx
  hooks/
    use-editor-state.ts
    use-scene-history.ts
    use-stage-scale.ts
    use-template-asset-url.ts
    use-text-fit.ts

lib/template-scene/
  index.ts
  types.ts
  canvas-presets.ts
  placeholders.ts
  google-fonts.ts
  text-style.ts
  normalize-scene-document.ts
  validate-scene-document.ts
  hydrate-scene.ts
  resolve-binding.ts
  calculate-object-fit.ts
  calculate-text-fit.ts
  adapt-layout-ratio.ts
```

`adapt-layout-ratio.ts` is for a later multi-ratio feature. It can be stubbed or deferred until needed.

## Route Intent

The product route intent is:

| Route | Purpose |
| --- | --- |
| `/app/automations` | List automation types, toggles, and template counts |
| `/app/automations/[automationType]` | Template list for one automation type |
| `/app/automations/[automationType]/new` | Create template or choose preset |
| `/app/automations/[automationType]/[templateId]` | Edit existing template |

If the branch keeps the older documented `/templates` segment, the same semantics apply:

- `/app/automations/[type]/templates`
- `/app/automations/[type]/templates/new`
- `/app/automations/[type]/templates/[id]/edit`

Pick one route shape and keep code, links, tests, and docs consistent. Since the branch already appears to have `[automationType]` and `[templateId]` routes scaffolded, prefer the shorter route shape unless there is a strong reason to change.

Current implementation note: the app route uses user-facing slugs `/app/automations/result/...` and `/app/automations/preview/...`, mapped in code to backend values `match_result` and `match_announcement`.

## Technical Notes That Apply Across Phases

### Convex Limits and Storage Rules

Keep these constraints in mind while implementing every phase:

- Convex document fields have an effective maximum around 1 MB when encoded.
- Object values can have at most 1024 entries.
- Array values can have at most 8192 elements.
- Do not store unbounded child lists on parent documents.
- Use child tables for growing data.
- High-churn operational state should not be stored on stable shared profile documents.
- Template scenes can be inline for MVP because expected node count is small.
- If templates ever approach document limits, migrate scene JSON to `_storage` or a dedicated chunking approach in a later schema version.
- Convex Storage stores blobs; persist `storageId` references, not bytes or signed URLs.
- Use `_storage` metadata access through the system table pattern, not deprecated metadata APIs.

Because the MVP adds new tables, most schema changes are safe. The only migration-like concern is existing organizations that predate automation rows. Handle that with a one-time backfill or an explicit idempotent ensure mutation. If a later phase changes required fields or reshapes persisted scene documents, use the widen-migrate-narrow pattern:

1. Widen schema to allow old and new data.
2. Update code to write the new format and read both.
3. Backfill existing data.
4. Verify migration completion.
5. Narrow schema and remove old read compatibility.

### Schema Version Strategy

Every template has two version signals:

- Top-level template row field: `schemaVersion: 1`.
- `sceneDocument.schemaVersion: 1`.

They should match for MVP. The loader and normalizer should reject unsupported future versions until a migration function exists.

Future versioning plan:

- `v1`: basic Konva subset, binding keys from this document, static assets by `assetId`, dynamic values by `bindingKey`.
- `v2+`: implement `migrateSceneDocument(doc)` and either migrate on read or backfill before tightening validation.

Version history for user edits is still out of scope. `schemaVersion` is format compatibility, not user-visible revision history.

### Next.js and react-konva Boundary

Every component importing `react-konva` must be inside the dynamically imported editor tree.

Example route pattern:

```tsx
"use client";

import dynamic from "next/dynamic";
import { TemplateEditorSkeleton } from "@/components/template-editor/template-editor-skeleton";

const TemplateEditorRoot = dynamic(
  () => import("@/components/template-editor/template-editor-root"),
  { ssr: false, loading: () => <TemplateEditorSkeleton /> },
);
```

Do not import `Stage`, `Layer`, `Text`, `Image`, or `Transformer` in the page file unless that file is itself inside the dynamic boundary. The safe pattern is:

- Page/route component handles params, loading shell, and dynamic import.
- Dynamically imported editor root imports `react-konva`.
- Nested editor components import `react-konva`.
- Server render helpers never import client editor components.

If build fails with `Can't resolve 'canvas'`, first check the import boundary. If the boundary is correct and the build still fails, use the fallback config pattern:

```ts
const nextConfig: NextConfig = {
  webpack: (config) => {
    config.externals = [...(config.externals ?? []), { canvas: "canvas" }];
    return config;
  },
};
```

React 19 notes:

- `useRef<Konva.Stage>(null)` remains the expected ref pattern.
- Strict Mode can double-mount effects, so image-loading effects and history initialization need cleanup.
- Memoize heavy Konva event handlers with `useCallback` and derived node collections with `useMemo` where churn becomes visible.

### Stage Scaling and Coordinates

Use a fixed logical stage and scale visually:

```tsx
function useStageScale(logicalWidth: number, logicalHeight: number) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      const nextScale = Math.min(width / logicalWidth, height / logicalHeight, 1);
      setScale(nextScale);
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, [logicalWidth, logicalHeight]);

  return { containerRef, scale };
}
```

Pointer conversion when stage is scaled:

```ts
function getStagePointer(stage: Konva.Stage): { x: number; y: number } | null {
  const pos = stage.getPointerPosition();
  if (!pos) return null;
  const scale = stage.scaleX();
  return { x: pos.x / scale, y: pos.y / scale };
}
```

All persisted coordinates must be logical output pixels, not scaled browser pixels.

### Transformer Rules

Konva Transformer mutates scale, not dimensions. On transform end, read from refs, compute new attrs, dispatch to React state, and persist scale as `1`.

```ts
function bakeTransform(node: Konva.Node) {
  const scaleX = node.scaleX();
  const scaleY = node.scaleY();
  node.scaleX(1);
  node.scaleY(1);

  if (node.className === "Text") {
    const text = node as Konva.Text;
    text.width(Math.max(text.width() * scaleX, 30));
  } else {
    node.width(Math.max(node.width() * scaleX, 10));
    node.height(Math.max(node.height() * scaleY, 10));
  }
}
```

Text nodes should generally use horizontal resize anchors. Rect and Image nodes can use corner and side anchors.

### Text Editing Rules

`Konva.Text` is not editable. Use a DOM overlay:

1. Double-click a text node.
2. Set `editingTextNodeId`.
3. Hide the Konva text node and transformer while editing.
4. Position a `<textarea>` using the node absolute position, stage container bounds, stage scale, and rotation.
5. Sync visual styles from Konva attrs:
   - `fontSize`
   - `fontFamily`
   - `fontStyle`
   - `lineHeight`
   - `fill` -> CSS color
   - `align` -> CSS text align
   - `letterSpacing` if used
6. Commit on blur or Enter without Shift.
7. Restore Konva text rendering and push a history snapshot.

Use `attrs.textTransform: "uppercase"` instead of relying on CSS. Apply the transform in both browser display and server hydration:

```ts
function displayText(raw: string, attrs: TemplateNodeAttrs): string {
  return attrs.textTransform === "uppercase" ? raw.toUpperCase() : raw;
}
```

### Image Loading and Object Fit

Browser image rendering should use `use-image`:

```tsx
function SceneImage({ src, crop, ...props }: SceneImageProps) {
  const [image, status] = useImage(src, "anonymous");
  if (status === "loading") return null;
  if (!image) return null;
  return <Image image={image} crop={crop} {...props} />;
}
```

Resolution rules:

- Static upload: `assetId` -> signed Convex Storage URL -> `useImage`.
- Dynamic editor logo: `bindingKey` -> bundled placeholder image.
- Dynamic server logo: `bindingKey` -> match DTO logo source.

Konva does not have CSS `object-fit`, so compute crop rectangles in a shared pure function:

```ts
export function calculateObjectFit(
  srcWidth: number,
  srcHeight: number,
  destWidth: number,
  destHeight: number,
  mode: "cover" | "contain" | "fill",
): { x: number; y: number; width: number; height: number } {
  // Shared browser/server math.
}
```

If canvas export becomes tainted by image CORS behavior, verify Convex signed URL headers. If needed, proxy through a same-origin route. Do not work around this by persisting image data URLs in templates.

### Text Overflow

Supported text overflow modes:

| Mode | Behavior |
| --- | --- |
| `wrap` | Fixed font size, word wrap inside width |
| `shrink` | Binary search font size until content fits |
| `ellipsis` | Truncate measured text and append ellipsis |
| `fixed` | Single line or fixed box; clipping is allowed |

Shared shrink-to-fit shape:

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
    const measured = measure(text, mid);
    if (measured.width <= maxWidth && measured.height <= maxHeight) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  return best;
}
```

Default suggestion:

- Bound team names use `shrink`.
- Static headings use `wrap`.

### Layer, Overlay, and Performance Rules

Layer behavior:

- Store z-order as array order in the content layer's `children`.
- Reordering layers is an immutable array splice.
- `attrs.name` can drive layer labels.
- Locking should prevent drag/transform and can use `listening={false}` if the UX still allows selection from the layer panel.
- Visibility can persist as `visible`.

Overlay behavior:

- Overlay layer is a second React-rendered `<Layer listening={false}>`.
- It can show center guides, safe zones, drag guides, or later watermark preview.
- It must never be included in normalized scene JSON.

Performance guidelines:

- One content layer is enough for MVP.
- Keep templates under roughly 30 nodes.
- Debounce numeric property inputs.
- Commit history snapshots only on discrete actions.
- Let react-konva batch normal state-driven renders.
- Use `batchDraw()` only after bulk hydration or transformer attachment.
- Use `listening={false}` on static background images where possible.

### Server Render Parity Checklist

The browser and server render paths must share:

| Concern | Shared implementation |
| --- | --- |
| Object fit | `calculate-object-fit.ts` |
| Shrink text | `calculate-text-fit.ts` |
| Binding text | `resolve-binding.ts` |
| Uppercase | `displayText()` |
| Date/time | `formatBinding()` with `nl-BE` |
| Gradients | Same Konva attrs |
| Fonts | Same `fontFamily` names; editor loads via Google Fonts CDN; server downloads matching `.woff2` URLs from a generated manifest, caches to `os.tmpdir()`, and registers via skia-canvas `FontLibrary.use()` (see **Google Fonts — server render strategy**) |

When the catalog changes, update `lib/template-scene/google-fonts.ts` and re-run the font sync script. Club-uploaded custom fonts remain out of scope.

## Phase 1 - Database Backbone and Minimal UI

Goal: prove that automations exist per organization, can be toggled from the UI, and can create a minimal template row visible in the database. This phase intentionally has almost no editor behavior.

### Backend Scope

Implement:

- Add `organizationAutomations`, `automationTemplates`, and `templateAssets` tables to `convex/schema.ts`.
- Add shared automation type and canvas preset constants.
- Seed `organizationAutomations` rows when a new organization is created.
- Add an idempotent helper to ensure existing organizations have the two MVP automation rows.
- Add `listAutomations`.
- Add `setAutomationGlobalEnabled`.
- Add `setAutomationPostingChannelEnabled` for Facebook/Instagram post/story channel preferences.
- Add `listTemplates` filtered by `automationType`.
- Add `createTemplate` that inserts a very basic valid scene document.
- Add `deleteTemplate` only if the UI needs it in this phase; otherwise defer.

Minimal starter `sceneDocument` for Phase 1:

```ts
{
  schemaVersion: 1,
  stage: {
    className: "Stage",
    attrs: { width: 1080, height: 1080 },
    children: [
      {
        className: "Layer",
        attrs: {},
        children: [
          {
            className: "Rect",
            attrs: { id: "background", x: 0, y: 0, width: 1080, height: 1080, fill: "#ffffff" },
          },
          {
            className: "Text",
            attrs: { id: "title", x: 80, y: 80, width: 920, text: "Matchscore template", fontSize: 64, fill: "#111827" },
          },
        ],
      },
    ],
  },
}
```

Backend details:

- All functions derive the organization from the authenticated user membership.
- `listAutomations` should return both automation rows plus template counts.
- Counts can be computed safely for two automation types in MVP, but avoid patterns that will become unbounded. A bounded per-type query is acceptable for this small fixed set.
- Automation mutations record `updatedAt` and `updatedByUserId` if available.
- `createTemplate` sets `schemaVersion: 1`, `canvasPreset`, `createdAt`, `updatedAt`, and `createdByUserId`.
- `automationType` and `canvasPreset` are validated through Convex validators.
- If existing organizations have no automation rows, `listAutomations` should either call an idempotent ensure helper from a mutation path before this phase is tested, or the phase should include a one-time internal backfill for dev data.

### Frontend Scope

Implement:

- `/app/automations` loads `listAutomations`.
- Show two automation cards: Match announcement and Match result.
- Each card shows:
  - user-facing title and short description
  - global enabled/disabled switch
  - Facebook/Instagram post/story channel switches
  - template count
  - link to the automation type page
- Toggling switches calls the global or channel mutation and shows Sonner success/error feedback.
- `/app/automations/[automationType]` lists templates for that type.
- Add a "Create basic template" button.
- Clicking it calls `createTemplate`, then routes to the template detail route or keeps the user on the list with the new row visible.
- The template detail route can be a read-only placeholder in this phase that displays:
  - template name
  - automation type
  - canvas preset
  - a note that the visual editor starts in Phase 2

No `react-konva` is required in Phase 1.

### Agent Testing Before User Handoff

Automated checks:

- Run the repository's lint/type/test commands after inspecting `package.json`.
- Add focused Convex tests if the repo already has `convex-test`; otherwise document the missing test harness and cover with function-level manual verification.
- Verify `listAutomations` returns exactly two rows for a test organization.
- Verify `setAutomationGlobalEnabled` changes only the requested row.
- Verify `setAutomationPostingChannelEnabled` changes only the requested channel preference.
- Verify `createTemplate` inserts a template with `schemaVersion: 1`, the selected `automationType`, and the selected `canvasPreset`.

Browser checks:

- Open `/app/automations`.
- Confirm both automation cards render.
- Toggle `match_announcement` off and back on.
- Confirm the UI updates and toasts appear.
- Open one automation type page.
- Create a basic template.
- Confirm the template appears in the list.
- Open the template placeholder page.

Database checks:

- Confirm `organizationAutomations` has two rows for the active organization.
- Confirm toggling updates `isGloballyEnabled`, `postingChannels`, and `updatedAt` as appropriate.
- Confirm `automationTemplates` has one new row after pressing "Create basic template".
- Confirm `sceneDocument.schemaVersion === 1`.
- Confirm no template row is created under another organization.

User testing script:

1. Go to `/app/automations`.
2. Toggle both automation types and refresh the page.
3. Open `Match announcement`.
4. Create a basic template.
5. Refresh and confirm it remains in the list.

Phase 1 is complete only when the UI flow works and the database state matches the user actions.

## Phase 2 - Static Template Editor With Save and Reload

Goal: replace the placeholder template page with a real but minimal react-konva editor that edits static shapes/text and persists the scene back to Convex.

### Backend Scope

Implement or extend:

- `getTemplate`.
- `updateTemplate`.
- `validateSceneDocument`.
- `normalizeSceneDocument` shared logic where practical.
- Return data needed by the editor: template id, name, automation type, canvas preset, scene document.

Validation requirements:

- `schemaVersion` must be `1`.
- Root node must be `Stage`.
- Content must use only allowed MVP classes.
- Strip or reject editor-only attrs.
- Reject custom functions, filters, and unsupported shapes.
- Reject scene documents that do not match the selected canvas preset size.
- Ensure `automationType` cannot be changed through `updateTemplate`.
- Ensure the template belongs to the current organization before returning or updating it.

### Frontend Scope

Install and wire client-only editor dependencies:

- `konva`
- `react-konva`
- `use-image` can be deferred until Phase 3 dynamic logo placeholders or Phase 4 static image uploads.

Implement:

- Dynamic import boundary for the editor root with `ssr: false`.
- `TemplateEditorSkeleton`.
- `template-editor-root.tsx` layout with toolbar, center canvas area, and basic side panel.
- `useStageScale` so the stage keeps logical preset size and scales visually to fit.
- Render `Rect` and `Text` nodes from React scene state.
- Select nodes by click.
- Drag nodes and update React scene state on drag end.
- Resize/rotate with `Transformer`.
- Bake transform scale into width/height on transform end.
- Basic property panel for selected node:
  - width
  - height
  - fill for rects/text
  - text value for text nodes
  - font size for text nodes
- Do not add numeric `x`/`y` fields to the user-facing property panel. Positioning is handled by drag and drop.
- Save button calls `updateTemplate`.
- Reloading the page loads the saved scene from Convex.
- Dirty state in the toolbar.

Out of scope for Phase 2:

- Asset uploads.
- Image nodes.
- Binding dropdowns.
- Preview mode.
- DOM textarea text editing.
- Layer panel reorder.
- Undo/redo.

### Agent Testing Before User Handoff

Automated checks:

- Unit tests for `normalizeSceneDocument`:
  - accepts minimal Stage/Layer/Rect/Text fixture
  - rejects unsupported `Circle`
  - strips `draggable`
  - rejects filters/custom scene functions
  - bakes scale when present
- Type/lint checks.
- Run build or at least the Next command that catches invalid server imports.
- Confirm no `react-konva`, `konva/skia-backend`, or `skia-canvas` imports leak into server route files.

Browser checks:

- Open an existing template.
- Select text.
- Move it.
- Change its text and color in the panel.
- Resize it.
- Save.
- Refresh the page.
- Confirm the changes remain.
- Navigate away and back.
- Confirm the scene still renders.

Database checks:

- Confirm `automationTemplates.updatedAt` changes on save.
- Confirm `sceneDocument.stage` contains the changed attrs.
- Confirm there is no persisted transformer or overlay data.
- Confirm `scaleX`/`scaleY` are not persisted after resizing.

User testing script:

1. Create a basic template from Phase 1.
2. Open it.
3. Move the text.
4. Change the text content and color.
5. Save and refresh.
6. Confirm the visual result is preserved.

Phase 2 is complete only when a static template can be edited, saved, and faithfully reloaded.

## Phase 3 - Variables, Bindings, and Placeholder Preview

Goal: make templates useful for match automations by adding data bindings through the property panel while still using placeholder data.

### Backend Scope

Extend validation:

- Add typed binding key definitions.
- Validate text binding keys:
  - `homeClubName`
  - `awayClubName`
  - `homeAwayClubNames`
  - `matchAddress`
  - `matchDateTime`
  - `score`
- Validate image binding keys:
  - `homeClubLogo`
  - `awayClubLogo`
- Reject `score` on `match_announcement`.
- Validate `bindingKey` type matches node class:
  - text bindings only on `Text`
  - image bindings only on `Image`
- Reject nodes where `assetId` and `bindingKey` are both set.
- Keep `schemaVersion: 1`.

No new tables are needed.

### Frontend Scope

Implement:

- Placeholder text constants:
  - `homeClubName`: `Thuisploeg`
  - `awayClubName`: `Uitploeg`
  - `homeAwayClubNames`: `Thuisploeg - Uitploeg`
  - `matchAddress`: `Adres van de wedstrijd`
  - `matchDateTime`: `za 15 mrt. 2025, 20:00`
  - `score`: `2 - 1`
- Bundled placeholder crest images for `homeClubLogo` and `awayClubLogo`.
- Property panel section "Inhoud":
  - Fixed text
  - Variable
- If variable is selected, show a second dropdown of bindings filtered by automation type.
- Canvas displays the placeholder value immediately when a binding is selected.
- Add simple `Image` support for dynamic logo placeholders in Phase 3:
  - render `Image` nodes whose source is a valid image `bindingKey`
  - add minimal editor controls to insert home/away logo placeholder nodes
  - allow selection, drag, resize, save, and reload for these dynamic logo nodes
  - store the logo source as `attrs.bindingKey`, never as a resolved URL or image bytes
  - keep static uploaded images and `assetId` insertion for Phase 4
- If `use-image` was not installed in Phase 2, install it for Phase 3 image hydration.
- Preview/design toggle:
  - Design mode can show placeholders.
  - Preview mode can show richer mock fixture values.
- Ensure the saved scene stores the `bindingKey` and not the resolved text as the source of truth for dynamic content.
- Ensure the scene update helper can remove attrs when switching between fixed and variable content, so stale `text`, `assetId`, or `bindingKey` values are not accidentally persisted.

Important UX rule:

- Users should never need to type `{{homeClubName}}`.

### Agent Testing Before User Handoff

Automated checks:

- Unit tests for binding validation.
- Unit tests that available binding keys differ by automation type.
- Unit tests for `resolveTextContent`.
- Unit tests for dynamic image binding validation and placeholder resolution.
- Normalizer tests for `assetId`/`bindingKey` exclusivity.
- Type/lint checks.

Browser checks:

- Open a `match_announcement` template.
- Select a text node.
- Change it from fixed text to variable `homeClubName`.
- Confirm placeholder appears.
- Confirm `score` is not available.
- Save and refresh.
- Confirm the binding still displays placeholder text.
- Open a `match_result` template.
- Confirm `score` is available.
- Bind a text node to `score`, save, and reload.
- Insert a dynamic home or away logo placeholder, save, refresh, and confirm it still renders as a placeholder image.
- Toggle preview mode if implemented and confirm mock values render.

Database checks:

- Confirm bound text nodes persist `attrs.bindingKey`.
- Confirm dynamic placeholder text is not incorrectly persisted as a static replacement unless the fixed text mode is selected.
- Confirm bound logo image nodes persist `attrs.bindingKey` and do not persist a signed URL, raw image data, or `assetId`.
- Confirm invalid bindings are rejected by the mutation, not just hidden in the UI.

User testing script:

1. Open a match announcement template.
2. Select a text layer.
3. Set content to variable `homeClubName`.
4. Save and refresh.
5. Confirm the placeholder remains and the binding dropdown still shows the selected binding.
6. Insert a home or away logo placeholder and confirm it survives save/reload.
7. Repeat on a match result template with `score`.

Phase 3 is complete only when text and dynamic logo variable bindings survive save/reload and invalid bindings cannot be saved.

## Phase 4 - Static Asset Uploads and Image Nodes

Goal: allow clubs to upload backgrounds and sponsor logos, insert them into templates, save them as `assetId` references, and hydrate them on reload.

Implementation status: completed on `templates-phase-4`.

### Backend Scope

Implement:

- `templateAssets.generateUploadUrl`.
- `templateAssets.saveTemplateAsset`.
- `templateAssets.listTemplateAssets`.
- `templateAssets.deleteTemplateAsset`.
- `listTemplateAssets` includes signed URLs generated from `storageId`.

Rules:

- Asset rows are scoped to the current organization.
- Store `storageId`, `fileName`, `mimeType`, `byteSize`, optional `pixelWidth`/`pixelHeight`, `uploadedByUserId`, and `createdAt`.
- Persist storage IDs and metadata only. Do not persist generated signed URLs.
- Accept only `image/png`, `image/jpeg`, and `image/webp`.
- Enforce an 8 MB byte-size limit.
- `deleteTemplateAsset` rejects if any template in the same organization references the asset in its scene document.
- `updateTemplate` rejects static `assetId` references that are missing or belong to another organization.
- Dynamic club logos are not inserted into `templateAssets`.

### Frontend Scope

Implement:

- Assets panel.
- Upload button using Convex Storage upload flow.
- Asset grid with preview-only image tiles.
- Asset delete affordance shown as a hover/focus trash icon on each tile.
- Drag an asset tile onto the canvas to insert it as an `Image` node.
- Inserted static image nodes preserve the uploaded image's intrinsic dimensions. For older asset rows without stored dimensions, the editor measures the generated image URL before creating the node.
- `SceneImage` component using `use-image`.
- Hydration from `assetId` to signed URL.
- Add image selection, drag, resize, and property editing.
- Add `objectFit` attr with at least:
  - `cover`
  - `contain`
  - `fill`
- Background tab:
  - No image: full-canvas background `Rect`, default white, editable color.
  - Image: bottom `Image` node with `id: "background"` and `assetId`.
  - Selecting the background node opens the Background tab, not the generic Options panel.
  - Background images start at cover size while preserving source aspect ratio.
  - Background images can be resized with transformer handles and repositioned by dragging.
  - Background images can be removed, returning to a color background.

Keep scope controlled:

- No advanced cropping UI yet.
- No image filters.
- No delete-cascade from templates.
- No general node deletion yet; delete/removal of normal image nodes remains Phase 5.

### Agent Testing Before User Handoff

Automated checks:

- Unit tests for `calculateObjectFit`.
- Unit tests for asset-reference scanning in scene documents.
- Convex tests for asset save/list/delete rejection can be added later if storage mocking is introduced.
- Type/lint/build checks.

Browser checks:

- Open template editor.
- Upload an image.
- Confirm it appears in the assets panel.
- Drag it into the canvas.
- Confirm its scene width/height match the original image dimensions.
- Move and resize it.
- Change object fit.
- Save and refresh.
- Confirm the image hydrates and renders.
- Use the Background tab to select an image background.
- Confirm selecting the background opens the Background tab.
- Resize and reposition the background image.
- Remove the background image and confirm the color background returns.
- Try deleting the asset while it is still referenced.
- Confirm deletion is rejected with clear feedback.

Database/storage checks:

- Confirm `_storage` has the uploaded file.
- Confirm `templateAssets` has one row with matching metadata.
- Confirm `templateAssets.pixelWidth` and `templateAssets.pixelHeight` are set for new uploads.
- Confirm `automationTemplates.sceneDocument` references the asset through `attrs.assetId`.
- Confirm no raw image bytes or signed URLs are persisted in `sceneDocument`.

User testing script:

1. Upload a sponsor image from the Assets tab.
2. Drag it to the template.
3. Confirm the image appears at its original dimensions.
4. Resize it and change image fit.
5. Save and refresh.
6. Confirm the image remains visible.
7. Try to delete the asset while it is used and confirm the app prevents it.
8. Open the Background tab.
9. Pick a background color.
10. Pick or upload a background image.
11. Resize and position the background image, then remove it and confirm the color background returns.

Phase 4 is complete only when static images are stored in Convex Storage, referenced by `assetId`, and rehydrated after reload.

## Phase 5 - Editor Usability, Text Editing, Layers, and History

Goal: turn the basic editor into a practical Canva-like MVP while staying within the approved Konva subset.

Implementation status: completed and merged to `main` (PR #14), with the deferred items noted below. Phase 5 also delivered several extras originally scoped for Phase 7 or polish passes.

### Backend Scope

No new tables should be needed.

Extend validation if these attrs are added:

- `overflowMode`
- `textTransform`
- `visible`
- `name`

Locking persists as `attrs.locked: boolean`. `listening` is editor-only and is stripped on save; it is not a persisted lock mechanism.

Ensure save validation still strips non-persisted UI state:

- guide lines
- transformer state
- temporary drag state
- overlay layer nodes
- text editing overlay state

### Frontend Scope

Implement:

- Fix existing image `objectFit: "contain"` rendering so the editor applies both the shared `calculateObjectFit` crop and render rectangles. This should happen before server render parity work because Phase 6 depends on browser/server image layout matching.
- DOM textarea overlay for editing `Konva.Text` on double-click.
  - Double-click editing applies to fixed text only.
  - Variable text nodes remain edited through the binding dropdown; double-clicking them should not silently convert them to fixed text.
- Text style controls:
  - searchable font picker with curated Google Fonts catalog (~50 families) plus system fonts (`components/template-editor/font-picker.tsx`, `lib/template-scene/google-fonts.ts`)
  - font size stepper with −/+ buttons
  - prominent full-width color picker row (swatch, label, hex)
  - bold, italic, underline, and uppercase (`aA`) toggles on one compact toolbar row
  - left/center/right alignment as square icon buttons on the same row as style toggles
  - line-height stepper on a secondary row paired with the overflow-mode select
  - uppercase transform through `attrs.textTransform`
  - compact properties layout for text nodes: no width/height fields, no fixed↔variable mode toggle (fixed text edited on canvas; bound text keeps the binding dropdown only)
- Text overflow modes:
  - `wrap`
  - `shrink`
  - `ellipsis`
  - `fixed`
- Shared `calculateTextFit` for shrink-to-fit.
- Layer panel:
  - row per content node
  - select on click
  - reorder by drag-and-drop with a drop indicator between rows; the full card is draggable, not only the grip icon
  - visibility toggle
  - lock toggle persisted as `attrs.locked`
  - per-row delete icon for non-background nodes
  - background row shows an `Achtergrond` / background badge only; variable-binding badges were intentionally omitted for cleaner rows
  - keep the canonical background node at the bottom or manage it through the Background tab rather than normal layer deletion
  - persisted `visible: false` hides the node in the editor and should hide it in future server render
  - canvas drag/transform auto-selects the moved node
- Undo/redo:
  - snapshot on drag end
  - transform end
  - text commit
  - layer reorder
  - add/delete
  - property commit
  - maximum history of 50
- Keyboard shortcuts:
  - delete selected non-background node
  - undo
  - redo
  - save
- Normal image node deletion:
  - allow removing uploaded sponsor/logo image nodes from the scene via Delete/Backspace, the properties panel delete button, or the layer-row trash icon
  - after a template no longer references an asset and the template is saved, the existing Assets panel delete flow can remove the asset row and storage blob; there is no automatic asset cleanup on save
- Text tab (delivered in Phase 5 as an extra; shapes tab remains deferred to Phase 7):
  - "Add a text box" button inserts body text at canvas center
  - draggable preset cards for heading (96px bold), subheading (64px bold), and body (40px)
  - presets can be dropped onto the canvas at the drop position or activated with Enter/Space (inserts at center)
  - new fixed-text nodes are created through `createFixedTextNode` and selected in the properties panel after insert
- Shapes tab insertion (`Rect` presets) remains deferred to Phase 7.
- Overlay layer:
  - center crosshair or safe-zone guides if useful
  - `listening={false}`
  - never persisted
  - deferred: not implemented in Phase 5
- Performance cleanup:
  - debounce numeric property inputs — deferred; numeric fields currently commit on each change
  - avoid manual `stage.draw()` except targeted `batchDraw()` after bulk hydration
  - keep node count target under 30 for MVP templates

Important transformer rule:

- Konva Transformer changes `scaleX` and `scaleY`; persist baked width/height instead.
- Text layers should use horizontal resize anchors when appropriate.

### Agent Testing Before User Handoff

Automated checks:

- Unit tests for `calculateTextFit` with mock measure function.
- Normalizer tests for Phase 5 attrs (`visible`, `locked`, `overflowMode`, `textTransform`, `name`, `fontFamily`, `lineHeight`, `align`) and rejection of invalid values.
- Normalizer tests confirming editor-only attrs such as `draggable` and `listening` are stripped.
- Type/lint/build checks.
- Deferred automated coverage: dedicated unit tests for layer reorder helpers and history stack behavior.

Browser checks:

- Double-click text and edit with textarea overlay.
- Commit with blur or Enter.
- Open the Text tab; add a text box and drag heading/subheading/body presets onto the canvas.
- Activate a text preset with Enter/Space and confirm it inserts at canvas center.
- Change font family via the searchable picker; confirm Google Fonts load and keyboard navigation works.
- Drag and resize several nodes.
- Reorder layers.
- Toggle visibility and lock.
- Undo and redo each action (including while inline text editing is open).
- Delete a node and undo it.
- Save and refresh.
- Confirm all persisted visual changes remain and non-persisted UI state is gone.

Database checks:

- Confirm layer order is represented by child array order.
- Confirm visibility and supported attrs persist.
- Confirm hidden/locked/editor-only behavior is represented only by approved attrs.
- Confirm undo history is not persisted.

User testing script:

1. Edit text by double-clicking it.
2. Open the Text tab; add a text box and drag a heading preset onto the canvas.
3. Select the new text and try font, color, B/I/U, alignment, and overflow controls.
4. Add or select multiple layers.
5. Reorder layers.
6. Toggle visibility.
7. Use undo and redo.
8. Save and refresh.
9. Confirm only the intended design state persisted.

Phase 5 is complete only when the editor feels usable for static layouts and the saved JSON remains clean.

### Phase 5 Implementation Notes

Implemented in `components/template-editor/static-template-editor.tsx`, `components/template-editor/font-picker.tsx`, and `lib/template-scene/`:

**Core Phase 5 scope**

- Image `objectFit: "contain"` uses shared `calculateObjectFit` crop and render rectangles in `SceneImage`.
- Fixed-text double-click editing via DOM textarea overlay; variable text stays binding-based.
- Inline text edits are flushed into the scene document before undo, redo, or save so in-progress textarea content is not lost.
- Text controls: searchable font picker, size/line-height steppers, prominent color row, B/I/U/uppercase + alignment toolbar, overflow modes (`wrap`, `shrink`, `ellipsis`, `fixed`).
- Layer panel with select, drag reorder, visibility, lock, delete, and background handling.
- Undo/redo with 50-entry cap; toolbar buttons plus Cmd/Ctrl+Z, Cmd/Ctrl+Shift+Z, and Cmd/Ctrl+Y.
- Keyboard Delete/Backspace removes the selected non-background node; Cmd/Ctrl+S saves.
- Node deletion from properties panel and layer rows.
- Canvas drag/transform auto-selects the active node.

**Text tab (extra — originally Phase 7)**

- Replaced the Text tab placeholder with a working `TextPanel`.
- "Add a text box" inserts a body preset at canvas center.
- Draggable heading / subheading / body preset cards insert fixed `Text` nodes via `TEXT_PRESET_DRAG_MIME` and `createFixedTextNode`.
- Keyboard users can activate presets with Enter/Space (same preset payload as drag; inserts at center).

**Typography and font extras**

- `lib/template-scene/google-fonts.ts`: curated catalog, lazy `loadGoogleFonts`, `searchTemplateFonts`, `collectSceneFontFamilies` (trimmed names), `shouldLoadGoogleFont` restricted to catalog entries.
- `lib/template-scene/text-style.ts`: Konva font-style and underline helpers (`parseKonvaFontStyle`, `buildKonvaFontStyle`, `toggleUnderline`, validators).
- `FontPicker`: keyboard navigation (ArrowUp/Down, Enter, Escape) and listbox ARIA (`role="listbox"`, `aria-activedescendant`, `aria-selected`).
- Properties panel layout order: font → size → color → style/alignment toolbar → overflow + line height.

**Validation and tests**

- `calculateTextFit` rejects non-function `measure` arguments.
- `isValidTextDecoration` type predicate includes `undefined`.
- `convex/automations/scenes.test.ts`: 28 tests covering Phase 5 attrs, text style, fonts, and text-fit behavior.

Deferred from the original Phase 5 scope:

- Overlay guide layer (center crosshair / safe zones).
- Debounced numeric property inputs.
- Dedicated automated tests for reorder/history helpers.
- Variable-binding badge in the layer list (removed during UX polish).
- Shapes tab insertion tools (still Phase 7).

## Google Fonts — server render strategy

The editor (Phase 5) and the server renderer must use the **same font family names** but load fonts through **different mechanisms**:

| Environment | Mechanism | Source |
| --- | --- | --- |
| Browser editor | Google Fonts CSS CDN via `loadGoogleFonts()` | `fonts.googleapis.com/css2` (weights 400/700, normal + italic) |
| Server render | Download `.woff2` files, cache locally, register before drawing | Stable `fonts.gstatic.com` URLs in `server-font-manifest.generated.ts` |

Neither `skia-canvas` nor `node-canvas` can consume Google Fonts **CSS** URLs directly. Both require **local font files** (`.woff2`, `.ttf`, or `.otf`) registered at runtime via `FontLibrary.use()`. **Approved backend:** skia-canvas with family aliases matching the editor catalog.

**Convex constraint (discovered in Phase 6):** static `.woff2` files committed in the repo are **not readable** from the Convex Node bundle at runtime (`/tmp/source/...` or `/var/task/...`). The implemented approach stores **HTTPS URLs** in the manifest and downloads fonts to `os.tmpdir()` on first use per family.

**Linux constraint (discovered in Phase 6):** Convex Node runs on Linux without Arial, Times New Roman, etc. System font families from the editor are mapped to downloadable stand-ins and registered under the **original family name**:

| Editor system font | Server stand-in (Google Font) |
| --- | --- |
| Arial, Helvetica | Arimo |
| Times New Roman, Georgia | Tinos |
| Verdana | Open Sans |

`Arimo` and `Tinos` are synced for server use only; they do not appear in the editor font picker.

### Why Phase 6 must include catalog font registration

Without server-side font files, templates that use catalog Google Fonts (most real templates) will silently fall back to wrong fonts on the server. That breaks the Phase 6 acceptance criterion (“acceptable visual parity”) and would make the later posting pipeline unusable for typical club designs.

**Decision:** implement catalog font registration in **Phase 6**, not Phase 7 and not deferred to the posting pipeline.

What stays deferred: **club-uploaded custom fonts** (`.ttf` uploads). Only the fixed catalog in `lib/template-scene/google-fonts.ts` is in scope.

### Implementation approach (catalog fonts) — as built

1. **Generated manifest:** `lib/template-scene/server-font-manifest.generated.ts` — maps each catalog family (plus server-only `Arimo`, `Tinos`) to stable `https://fonts.gstatic.com/.../*.woff2` URLs.
2. **Sync script:** `pnpm sync-template-fonts` (`scripts/sync-template-fonts.ts`) resolves URLs from Google Fonts CSS for every family in `GOOGLE_FONT_CATALOG` + `SERVER_ONLY_FONT_FAMILIES`. Run when the catalog changes; commit the regenerated manifest. Optionally caches files locally under `convex/automations/render/fonts/` for dev inspection — **gitignored**, not used at runtime on Convex (production downloads from the manifest URLs instead).
3. **Registry helper:** `lib/template-scene/server-font-registry.ts` (pure TypeScript):
   - `getFontUrlsForFamilies(families)` → `{ family, urls }[]` for catalog and system-mapped fonts
   - `assertTemplateFontManifestUsesRemoteUrls()` in tests
4. **Render action (Node only):** `convex/automations/render/register_scene_fonts.ts` downloads URLs to `os.tmpdir()/matchscore-template-fonts/`, then `FontLibrary.use(family, filePaths)` before `Konva.Node.create`.
5. **Runtime network fetch:** first render of a font family downloads from `fonts.gstatic.com`; subsequent renders reuse the temp cache within the same Convex Node process. Acceptable for MVP render-test and early posting; Phase 7 may revisit bundling strategy if cold-start latency or offline determinism becomes a concern.

**Not yet implemented:** Konva `fontStyle` → weight/style file selection (only default catalog weights are synced; bold/italic parity may drift for some families).

### Acceptable parity limits

Even with identical font files, Konva maintainers note that **pixel-perfect text parity between Chrome and any Node canvas backend is not guaranteed** (width, line breaks, vertical offset can differ slightly). Phase 6 targets **acceptable** parity: same fonts, same layout intent, same bindings/images/object-fit. Minor text metrics drift is acceptable; wrong font family is not.

### Mock match data and logo placeholders

Phase 6 uses a structured `MockMatchDto` + `formatBinding(key, match, "nl-BE")` (not editor design-mode `{{token}}` placeholders). Dynamic logo bindings use SVG crest placeholders from `lib/template-scene/placeholder-crest.ts`:

- **Editor:** `createPlaceholderCrestDataUrl()` — SVG as `data:image/svg+xml` (browser renders correctly).
- **Server:** `load_placeholder_crest.ts` rasterizes SVG → PNG before Konva, because skia-canvas + Konva `Image` with `crop` on a full-size stage drops SVG path/text and shows only the background rect.

Real federation club logos arrive with the match/posting integration later; no DB seed is required for Phase 6 unless you want richer mock PNG crests.

---

## Phase 6 - Server Render Parity Foundation

Goal: prove that a template from Convex can be rendered server-side to PNG with acceptable visual parity (layout, bindings, static assets, catalog fonts). This still does not implement scheduled posting or external API delivery.

Implementation status: **completed and merged to `main`** (PR #15).

### Confirmed product decisions (Phase 6)

- **Production posting** will render **saved** template rows from Convex (`templateId` only), without a logged-in dashboard session.
- **Render test UI** passes the editor’s **current canvas** (`sceneDocument`) so manual verification matches what the user sees; optional `sceneDocument` arg on `renderTemplateTest`. Production posting uses the saved DB row only.
- Binding text via `formatBinding()` + `MockMatchDto` + `nl-BE` date formatting (per original plan).
- Store render output in Convex `_storage`; return a signed URL. Leave preview blobs in storage (no cleanup job in this phase).
- Render test UI is for manual verification only; the same render function will later power cron-triggered posting.

### Backend render technology (approved)

**Stack:** `konva` + `import "konva/skia-backend"` + `skia-canvas` in Convex `"use node"` actions only.

Rationale: the editor runs in Chrome (Skia); skia-canvas is the closest headless match for layout, text, and image parity. Konva v10 documents this as the performance-oriented Node backend.

**Fallback (spike only):** if `skia-canvas` fails to install or run on the Convex Node runtime, retry with `konva/canvas-backend` + `canvas` (node-canvas). Do not pursue both in parallel unless the spike fails.

**First implementation step:** a minimal Convex Node action that renders a solid-color PNG and stores it in `_storage`, proving the native module bundles and runs on the dev deployment.

### Phase 6 file layout (as built)

```text
scripts/
  sync-template-fonts.ts            # generates URL manifest (+ optional local cache)
  test-template-render.ts           # local skia smoke test

lib/template-scene/
  mock-match.ts                     # MockMatchDto + DEFAULT_MOCK_MATCH
  format-binding.ts                 # formatBinding(key, match, "nl-BE")
  text-measure.ts                   # measureTextForFit, ellipsizeText (from editor)
  prepare-render-node.ts            # prepareTextForRender, prepareImageLayout
  placeholder-crest.ts              # SVG crest placeholders (editor + server source)
  server-font-registry.ts           # family → HTTPS URLs (pure TS)
  server-font-manifest.generated.ts # generated URL manifest — commit this
  google-fonts.ts                   # + SYSTEM_FONT_SERVER_SOURCES, SERVER_ONLY_FONT_FAMILIES
  index.ts                          # re-exports shared types/helpers

convex/automations/
  actions.ts                        # "use node" — renderTemplateTest, renderSpikeTest
  render/
    register_scene_fonts.ts         # "use node" — download + FontLibrary.use
    load_placeholder_crest.ts       # "use node" — SVG → PNG rasterize for Konva
    hydrate_scene.ts                # "use node" — Konva tree hydration
    render_template_to_png.ts       # "use node" — orchestrates render
    render.test.ts                  # integration tests (skia + fonts + crests)

convex.json                         # node.externalPackages: skia-canvas, konva
```

Keep all `"use node"` files that import `skia-canvas` or `konva/skia-backend` out of the import graph of queries, mutations, client code, and default-runtime Convex files. Shared pure-TS helpers live under `lib/template-scene/` and are safe to import from both editor and Node actions.

### Production render path (design context — not built in Phase 6)

Future posting will look like:

```text
Convex cron (match event / schedule)
  → internal Node action
  → load template + match DTO + asset blobs (via runQuery + ctx.storage.get)
  → register catalog fonts used in scene
  → hydrate + Konva render → PNG buffer
  → ctx.storage.store(png)
  → fetch(externalSocialApi, { imageUrl or bytes })
```

Phase 6 builds the middle section (hydrate + render + store + URL). Cron wiring and external API calls remain out of scope.

### Backend Scope

Implement in this order:

#### 6.1 — Native backend spike

- Add `skia-canvas` to `package.json`; add `skia-canvas` to pnpm `onlyBuiltDependencies`.
- `convex/automations/actions.ts` with `"use node"`: render a trivial PNG via Konva + skia-backend, store in `_storage`, return signed URL. Confirms Convex Node runtime compatibility before hydration work.

#### 6.2 — Shared render preparation (no native imports)

- `MockMatchDto` + `DEFAULT_MOCK_MATCH` + `formatBinding(key, match, "nl-BE")`.
- Extract text measurement helpers (`measureTextForFit`, `ellipsizeText`) from the editor into shared `lib/template-scene/` code.
- `prepareTextNodeAttrs` / `prepareImageLayout` pure functions mirroring `SceneNodeRenderer` / `SceneImage` browser logic (including background `id: "background"` cover behavior and `objectFit` crop math via `calculateObjectFit`).
- Unit tests for binding formatting and layout prep.

#### 6.3 — Font manifest + registry

- Run `pnpm sync-template-fonts`; commit `lib/template-scene/server-font-manifest.generated.ts`.
- `lib/template-scene/server-font-registry.ts` + `convex/automations/render/register_scene_fonts.ts` using skia-canvas `FontLibrary.use()`.
- System fonts mapped to Arimo/Tinos/Open Sans stand-ins (see **Google Fonts — server render strategy**).
- Test: scene using catalog + system fonts renders with correct family per text node; mixed Arial + Pacifico in one template.

#### 6.4 — Hydration + render core

- `convex/automations/render/hydrate_scene.ts` and `render_template_to_png.ts` (both `"use node"`).
- Public action `renderTemplateTest` in `convex/automations/actions.ts` orchestrates: load template → load assets → register fonts → render → store.
- Load template metadata via `ctx.runQuery(api.automations.queries.getTemplate, { templateId })` (auth from dashboard session). Accept optional `sceneDocument` override for render test. Add `internalQuery` variant later for cron posting.
- Resolve static images: look up `templateAssets` storage IDs via query, then `ctx.storage.get(storageId)` → buffer → skia-canvas `loadImage`.
- Resolve binding images: rasterized crest PNG placeholders via `load_placeholder_crest.ts` (upgradeable to match DTO logo URLs later).
- Apply text/image layout prep; export PNG via `stage.toDataURL()`.
- Store PNG in `_storage`; return `{ storageId, previewUrl }`.
- Internal `renderSpikeTest` action: trivial 100×100 PNG to verify native module on Convex.

Example shape:

```ts
"use node";

import Konva from "konva";
import "konva/skia-backend";

export async function renderTemplateToPng(
  sceneDocument: SceneDocument,
  automationType: AutomationType,
  match: MockMatchDto,
  deps: {
    loadAsset: (assetId: string) => Promise<Buffer | null>;
    loadBindingLogo: (key: ImageBindingKey) => Promise<unknown>;
    registerFonts: (families: string[]) => void;
  },
): Promise<Buffer> {
  deps.registerFonts(collectSceneFontFamilies(sceneDocument.stage));
  const stage = Konva.Node.create(sceneDocument.stage);
  await hydrateScene(stage, { automationType, match, ...deps });
  // export PNG buffer from stage
}
```

Rules:

- Do not use `ctx.db` inside actions; use `runQuery` / `runMutation`.
- Do not mix `"use node"` actions and queries/mutations in the same file.
- Files with native imports must not be imported from client code or non-Node Convex files.
- Do not implement actual social posting or crons in Phase 6.

### Frontend Scope

Implement a render test action in the editor UI:

- Add a **Render test** button in the editor toolbar.
- Calls the server render action with `{ templateId, sceneDocument }` (current canvas).
- Shows loading and success/error feedback via Sonner (app-wide toasts: bottom-right).
- Displays the rendered PNG in a dialog from the returned signed URL.
- Copy makes clear this is a render test of the current canvas, not a published social post.

### Agent Testing Before User Handoff

Automated checks:

- Unit tests for `formatBinding` and mock match fixtures.
- Unit tests for object-fit/text-fit/layout prep functions.
- Unit tests for `server-font-registry` URL mapping (catalog + system fonts).
- `convex/automations/render/render.test.ts`: font download, per-element fonts, logo crest pixel checks.
- `pnpm test:template-render`: local Pacifico smoke test.
- Build check: no `skia-canvas` or `konva/skia-backend` imports in client bundle or default-runtime Convex files.
- `renderSpikeTest` internal action succeeds on Convex dev deployment.

Browser checks:

- Open a template with background, fixed text, bound text, a Google Font (e.g. Montserrat), logo bindings, and an uploaded image.
- Click **Render test**.
- Confirm PNG dimensions match canvas preset.
- Visually compare editor preview mode vs rendered PNG (fonts, images, bindings, HOME/AWAY crest shields).

Database/storage checks:

- Confirm render output appears in `_storage`.
- Confirm returned signed URL displays the image.
- Confirm no social posting record is created.
- Confirm the template `sceneDocument` is not mutated by rendering.

User testing script:

1. Build a template with a Google Font, system font, variable binding, and logo placeholders.
2. Click **Render test** (save optional — test uses current canvas).
3. Compare the generated PNG to the editor preview.
4. Confirm no post is published.

Phase 6 is complete when a scene produces a server-rendered PNG with acceptable visual parity, including catalog Google Fonts, system fonts, and logo crest placeholders.

### Phase 6 Implementation Notes

**Delivered on `templates-phase-6`**

- Native backend spike verified (`renderSpikeTest` + `skia-canvas` in `convex.json` `externalPackages`).
- Shared render prep extracted to `lib/template-scene/`; editor uses shared text measurement.
- Font manifest with HTTPS URLs; runtime download + temp cache; system font stand-ins for Linux.
- Full render pipeline: normalize → register fonts → prepare bindings → hydrate images → PNG export.
- Logo crest placeholders: SVG in editor, PNG rasterization on server (`load_placeholder_crest.ts`).
- Editor **Render test** button + dialog + i18n (nl/en/fr/de).
- **40 tests** in `scenes.test.ts` + `render.test.ts`.

**Deviations from original plan**

| Planned | Built | Reason |
| --- | --- | --- |
| Committed `assets/template-fonts/` `.woff2` bundle | Generated URL manifest + runtime download | Convex Node cannot read repo static files at runtime |
| Render test uses saved DB template only | Passes current `sceneDocument` from editor | Better manual verification UX; production posting still uses saved row |
| System fonts need no registration | Mapped to Arimo/Tinos/Open Sans | Linux Convex runtime lacks Arial/Times/etc. |
| Logo SVG loaded directly in Konva | SVG rasterized to PNG first | skia + Konva `crop` on full-size stage drops SVG paths |

**Known limitations for Phase 7**

- First render of a new font family hits `fonts.gstatic.com` (cold-start latency).
- Bold/italic weight selection not fully mapped per family in manifest.
- Preview render blobs accumulate in `_storage` (no cleanup job).
- `renderTemplateTest` requires auth; cron posting needs internal query/action variant.

## Phase 7 - MVP Hardening and Handoff

Goal: stabilize the automation/template MVP before connecting real match data or social posting, and add only the smallest missing authoring tools if they are needed for handoff.

Implementation status: **implemented on `templates-phase-7`** — core MVP handoff scope is complete; a few planned-but-non-blocking items remain deferred (see **Remaining gaps** below).

### Backend Scope

Implement or verify:

- `deleteTemplate` hard delete.
- Deleting the last template leaves the automation enabled.
- Any template list query remains bounded or paginated.
- Random template selection helper can be designed but not wired to posting:
  - only considers current organization
  - filters by automation type
  - skips if no templates exist
  - uniformly selects one template
- Optional internal cleanup plan for organization deletion:
  - delete `organizationAutomations`
  - delete `automationTemplates`
  - delete `templateAssets`
  - delete storage blobs where appropriate

### Frontend Scope

Implement or verify:

- Remaining authoring insertion tools after Phase 5:
  - Text tab fixed-text insertion is done (add text box + heading/subheading/body presets)
  - add an allowed `Rect` shape from the Shapes tab
  - keep unsupported shapes such as `Circle`, `Line`, and `Path` out of the MVP unless the allowed Konva subset is intentionally expanded
- Delete template dialog.
- Empty states:
  - automation enabled with zero templates is allowed
  - UI can explain "no template yet" without forcing disable
- Clear route navigation:
  - back to automation list
  - back to templates for the current automation type
- Loading and error states.
- Responsive editor layout:
  - side panels become drawers or collapse on small screens
- Final copy uses "club" for users and `organization` only in code.

### Agent Testing Before User Handoff

Automated checks:

- Full lint/type/test suite.
- Production build.
- Focused tests for delete behavior.
- Focused tests that deleting the last template does not disable automation.
- Tests for permission boundaries if the auth test harness supports multiple organizations.

Browser checks:

- Create two templates.
- Delete one.
- Delete the last one.
- Confirm the automation remains enabled.
- Toggle automation off/on with zero templates.
- Confirm no error is shown.
- Confirm empty states are understandable.

Database checks:

- Confirm deleted template rows are gone.
- Confirm `organizationAutomations.isGloballyEnabled` and `postingChannels` are unchanged after deleting templates.
- Confirm asset reference rules still hold.
- Confirm no cross-organization templates are visible.

User testing script:

1. Create and delete templates.
2. Toggle automations with and without templates.
3. Confirm the UI makes sense when no templates exist.
4. Confirm editing still works after refresh/navigation.

Phase 7 is complete only when the MVP is stable enough to hand off before match data and posting integration.

### Phase 7 Implementation Notes

**Delivered on `templates-phase-7`**

#### Core Phase 7 scope (plan)

| Planned item | Status | Where |
| --- | --- | --- |
| `deleteTemplate` hard delete | Done | `convex/automations/mutations.ts` — deletes row; removes `lastRenderPreviewStorageId` and `thumbnailStorageId` from `_storage` |
| Delete last template → automation stays enabled | Done (behavior) | `deleteTemplate` never touches `organizationAutomations`; no template-count guard on enable mutations |
| Delete template dialog | Done | `components/automations/delete-template-dialog.tsx` + `template-list-item.tsx` with Sonner feedback |
| Empty states (0 templates) | Done | `components/automations/template-list.tsx` dashed empty state + create CTA |
| Route navigation | Done | `AppPageBackLink` on template list page; editor back link via `backHref` in `template-editor-root.tsx` |
| Loading states | Done | Skeleton cards on `/app/automations` (`page.tsx`); skeleton rows in `template-list.tsx`; `template-editor-skeleton.tsx` for dynamic import |
| Shapes tab | Done (expanded) | `components/template-editor/shapes-panel.tsx` + `lib/template-scene/shape-presets.ts` — see **Extras** below |
| Responsive editor | Done (alternate approach) | Mobile gate at `< lg` (1024px) instead of collapsible drawers — see **Deviations** |
| Club-facing copy | Mostly done | Automations UI uses "club" in `messages/*.json`; invite flow still interpolates `{organizationName}` |

#### Extras (beyond original Phase 7 plan)

These were added during Phase 7 implementation or the properties-panel polish pass:

| Extra | Where |
| --- | --- |
| **Shapes tab — full preset library (17 presets)** | `lib/template-scene/shape-presets.ts`, `components/template-editor/shapes-panel.tsx` — rects, circle, triangles, polygons, stars, lines, arrows; drag/click/keyboard insert |
| **Expanded allowed Konva classes** | `lib/template-scene/index.ts` — `Circle`, `RegularPolygon`, `Star`, `Line`, `Arrow` added to validation + editor render path in `static-template-editor.tsx` |
| **Shape property editor** | `NodePropertiesPanel` — fill color, stroke width, stroke color (conditional), corner radius, line dash presets, rotation |
| **Line endpoint handles (2 anchors)** | `lib/template-scene/line-points.ts` (`LINE_VERTEX_COUNT = 2`), `components/template-editor/line-point-handles.tsx` — start/end only; legacy 3-point lines normalize to start+end on save |
| **Properties panel UX polish** | Rotation moved to bottom for all element types; stroke color hidden when `strokeWidth === 0`; `PanelStepperInput` layout fixed via `cn()` merge; image "Inhoud" description blocks removed |
| **Debounced autosave** | `hooks/use-template-autosave.ts` (2500ms idle debounce); toolbar shows saving / unsaved / saved; manual Save + Cmd/Ctrl+S still toasts; `beforeunload` warning when dirty |
| **Mobile editor gate** | `template-editor-root.tsx` — editor hidden below `lg` with viewport-too-small message (i18n nl/en/fr/de) |
| **Overview hint (automation on, 0 templates)** | `components/automations/automation-type-card.tsx` — amber `activeNoTemplatesHint` |
| **Render preview blob cleanup** | `lastRenderPreviewStorageId` on `automationTemplates` (`convex/schema.ts`); `convex/automations/internalMutations.ts` `replaceTemplateRenderPreview` deletes previous blob on each render test; delete template also cleans storage |
| **Org deletion cleanup helper** | `convex/automations/cleanup.ts` — `deleteOrganizationAutomationData()` (documented, not wired to org deletion yet) |
| **Removed template list `.take(100)` cap** | `convex/automations/queries.ts` — full list per org/type; `templateCountIsCapped` UI removed |
| **Scene validation tests for shapes** | `convex/automations/scenes.test.ts` — expanded shape classes, 2-point line normalization; **48 tests** total across scene + render suites |

#### Deviations from original Phase 7 plan

| Planned | Built | Reason |
| --- | --- | --- |
| Shapes tab: `Rect` only | 17 presets across 4 categories including circles, polygons, stars, lines, arrows | Intentional MVP authoring expansion; `Path` and filters remain rejected |
| Responsive: drawers/collapse on small screens | Hard mobile gate below 1024px | Simpler UX for a desktop-first Canva-like editor; touch editing on phone is poor anyway |
| Template list bounded/paginated | Unbounded `.collect()` | Removed artificial 100-template cap; MVP clubs have few templates; revisit if counts grow |
| Random template selection helper | Not implemented | Deferred to posting integration phase; no cron/posting yet |
| Org cleanup wired to `deleteOrganization` | Helper only | No org-delete mutation exists yet; helper is ready for future wiring |
| Focused delete / last-template tests | Not added | Scene/render tests expanded; delete mutation behavior untested in automation |

#### Remaining gaps (non-blocking for MVP handoff)

1. **`selectRandomTemplate` helper** — design-only deferral until posting pipeline.
2. **Org deletion wiring** — `deleteOrganizationAutomationData` exists but is not called.
3. **Focused Convex tests** for `deleteTemplate`, last-template-stays-enabled, and multi-org permission boundaries.
4. **Production build verification** — run `pnpm build` before merge (not recorded in this branch note).
5. **Page-level query error UI** — failed `listAutomations` / `getTemplate` show loading/empty states; no dedicated error boundary.
6. **Overlay guide layer** — still deferred from Phase 5.
7. **Debounced numeric property inputs** — still commit on each change (autosave debounces the save, not panel keystrokes).

#### Post-MVP (unchanged — Final Deferred Roadmap)

Match/calendar integration, posting pipeline, social OAuth, thumbnails, template duplication, email nudges, asset orphan sweep, club-uploaded custom fonts, and advanced Konva features remain out of scope until explicitly requested.

## Final Deferred Roadmap

These items must remain out of the MVP unless explicitly pulled into a later implementation request:

- `starting_eleven` automation.
- Federation club ID and match/calendar integration.
- Real match table and variable resolution from match DTOs.
- Posting pipeline.
- Convex scheduled functions for posting.
- Meta OAuth and social account connection.
- Subscription gating for posting.
- Watermark layers.
- Template thumbnails.
- Template duplication.
- Full live preview with real fixture data.
- Email nudge for active automations with zero templates.
- Asset reference integrity background sweep.
- Club-uploaded custom font files (`.ttf`/`.otf` uploads beyond the curated Google Fonts catalog).
- Advanced filters, custom shapes, animations, or rich text.

## Cross-Phase Pitfalls to Avoid

- Do not import `react-konva` in server components or app route files that are not behind the dynamic editor boundary.
- Do not import `skia-canvas` or `konva/skia-backend` in client code or default-runtime Convex files.
- Do not size the stage to the browser window.
- Do not persist `scaleX`/`scaleY` after transforms.
- Do not persist transformer nodes, guide lines, or overlay state.
- Do not rely on raw `stage.toJSON()` as live state on every frame.
- Do not store image bytes or signed URLs in `sceneDocument`.
- Do not use `{{mustache}}` variables in text.
- Do not use unsupported Konva features in MVP.
- Do not require a template before enabling an automation.
- Do not disable an automation when its last template is deleted.
- Do not block editing for subscription lapse; only future posting is blocked.
- Do not query Convex with unindexed filters for growing tables.
- Do not accept user or organization ids from clients for authorization decisions.

## Final Acceptance Criteria

The phased implementation is considered complete for this MVP when:

- Every organization has two default enabled automation rows.
- Users can toggle each automation type.
- Users can create, edit, save, reload, and delete templates.
- Templates are scoped to the user's organization.
- Scene documents are normalized Konva JSON with `schemaVersion: 1`.
- Static images are stored in Convex Storage and referenced by `assetId`.
- Dynamic values are stored as `bindingKey` attrs.
- `match_announcement` and `match_result` expose only valid bindings.
- The editor uses fixed logical canvas presets and visual scaling.
- The saved scene contains no editor-only state.
- The server render test can produce a PNG from the current editor canvas (or saved scene for production posting).
- Automated checks, browser checks, and database checks pass at each phase before user handoff.

