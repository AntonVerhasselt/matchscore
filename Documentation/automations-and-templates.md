# Automations & templates — implementation brief

> **Status:** Approved direction (MVP scope)  
> **Branch:** `feature/club-automations-templates`  
> **Scope:** Database design, template JSON format, and editor/render conventions for the first two automation types. Does **not** cover match data, rendering jobs, or social posting.

---

## 1. Context & product premise

Matchscore automates social media for **Belgian amateur football clubs**. Each registered club (organisation) can:

1. Design **visual templates** for automated posts (backgrounds, text layout, sponsor logos).
2. Toggle **automations** on or off per post type.
3. (Later) Connect social accounts; Matchscore picks a template, fills variables, renders, and posts.

**MVP automation types (this brief):**

| Type | Trigger (future) | Purpose |
|------|------------------|---------|
| `match_announcement` | 2 days before kick-off | Opponent, location, date/time |
| `match_result` | When federation publishes result | Score visual |

**Deferred:** `starting_eleven`, subscription/watermark gating, thumbnails, social posting, match/calendar tables.

**User-facing copy says “club”; code and schema use `organization`.**

---

## 2. Problem statement

We need to store, per organisation:

- **Automation state** — which post types are enabled (active by default; posting is skipped until at least one template exists).
- **Templates** — graphical layouts created in **react-konva**, persisted as JSON, later rendered server-side with **skia-canvas**.

The stored JSON must:

1. Reload faithfully in the **template editor** (react-konva).
2. Be renderable on the **server** with the same visual output (via Konva’s skia backend).

We are **not** designing match storage, render scheduling, or Meta API integration in this phase.

---

## 3. Investigation summary

### 3.1 react-konva (editor)

- Declarative React bindings over the Konva scene graph (`Stage`, `Layer`, `Text`, `Image`, `Rect`, etc.).
- Browser-only; fits a client-side template designer in Next.js (`"use client"`).
- Export/load: `stage.toJSON()` and `Konva.Node.create(json)`.
- **Images are not serialized** — only attrs survive. Custom attrs (e.g. `assetId`, `bindingKey`) must be set explicitly and re-hydrated on load.
- Konva’s [best-practices doc](https://konvajs.org/docs/data_and_serialization/Best_Practices.html) warns that raw `toJSON()` alone is fragile in large apps; for Matchscore’s MVP (background + text + static logos, basic shapes) a **normalized Konva document with conventions** is sufficient.

### 3.2 skia-canvas (server render)

- Node.js implementation of the HTML Canvas 2D API; used for off-screen image generation.
- Strong text and image support; exports PNG/JPEG via `toBuffer()` / `toURL()`.

### 3.3 Critical discovery: Konva + skia-canvas are already integrated

Konva v10+ supports an explicit **skia backend**:

```ts
import Konva from "konva";
import "konva/skia-backend";
```

The **same Konva scene JSON** can be:

- Edited in the browser with **react-konva**
- Rendered on the server with **Konva + skia-canvas** (no hand-written Canvas 2D translator)

This was the main architectural unlock. Alternatives considered:

| Approach | Pros | Cons | Verdict |
|----------|------|------|---------|
| **A. Normalized Konva JSON** | One format; official skia backend; fastest MVP | Konva version coupling; verbose JSON | **Chosen** |
| B. Custom scene schema → Canvas 2D | Smaller payloads; full control | Two render paths; high maintenance | Rejected for MVP |
| C. Dual storage (Konva + canonical) | Editor flexibility | Two sources of truth | Rejected |

### 3.4 Convex constraints relevant to design

- Document fields max **~1 MB** (UTF-8).
- Objects max **1024 keys**; arrays max **8192 elements**.
- Do not embed unbounded child lists on parent documents — use separate tables.
- File blobs: **`_storage`** table + `storageId` references (not yet used in this project).

For MVP templates (single 1080×1080 stage, handful of nodes), inline `sceneDocument` objects are expected to stay well under 1 MB. Revisit `_storage` for JSON only if real templates approach size limits.

---

## 4. Decisions log (from product Q&A)

| Topic | Decision | Rationale |
|-------|----------|-----------|
| Automation types (MVP) | `match_announcement`, `match_result` only | Starting 11 later |
| Initial automation state | All **active** on org creation | Automations on by default; clubs add templates when ready |
| Enable rule | User can toggle freely; **no template required** to stay active | Posting job skips types with 0 templates |
| Active-but-no-template nudge | **Deferred** — email reminder to add a template | Future onboarding/retention feature |
| Template pick at post time | Uniform **random** among templates | Simple MVP |
| Subscription lapse | Block **posting** only; editing still allowed | User answer #6 |
| Canvas dimensions | **Fixed presets** (common social sizes) | One image for FB + IG |
| Static images | `templateAssets` (backgrounds, sponsors) | MVP |
| Dynamic images (club logos) | Resolved at **render** from match data; **placeholder** in editor | Not in `templateAssets` |
| Home/away | User’s club may be home **or** away; variables are match-relative | `homeClubLogo`, not “our logo” |
| Date/time format | **`nl-BE`** locale | Fixed for MVP |
| Variable UX (MVP) | **Property panel** with binding dropdown (see §6) | Best for non-technical volunteers |
| Live preview (MVP) | **Static placeholder** values in editor | Full live preview later |
| Template limit | None | — |
| Version history | None; overwrite on save | — |
| Permissions | All org members; **no roles** | Matches current org model |
| Watermark | Out of scope | — |
| Scene storage | **Inline** `sceneDocument` on template row | Simplest; monitor size |
| Fonts | **System fonts** only | No upload pipeline |
| Konva features (MVP) | **Basics**: `Stage`, `Layer`, `Rect`, `Text`, `Image` | No filters/custom shapes |
| Schema versioning | **`schemaVersion: 1`** on every template | Cheap insurance for migrations |
| Thumbnail | **Optional** `thumbnailStorageId` | Implement later |
| Delete templates | **Hard delete** | Simple |
| Org deletion cascade | Keep simple; delete child rows when org removed | Future org-delete flow |

---

## 5. Database schema

### 5.1 Tables overview

```
organizations (existing)
    │
    ├── organizationAutomations (1 row per automation type)
    │
    ├── automationTemplates (0..N per type)
    │
    └── templateAssets (static uploads)
```

### 5.2 `organizationAutomations`

One row per organisation per automation type. Created when the organisation is created.

```ts
organizationAutomations: defineTable({
  organizationId: v.id("organizations"),
  automationType: v.union(
    v.literal("match_announcement"),
    v.literal("match_result"),
    // v.literal("starting_eleven"), // add when feature ships
  ),
  isEnabled: v.boolean(),
  updatedAt: v.number(),
  updatedByUserId: v.optional(v.string()),
})
  .index("by_organizationId", ["organizationId"])
  .index("by_organizationId_and_automationType", [
    "organizationId",
    "automationType",
  ]);
```

**Invariants:**

- Exactly **2 rows** per org in MVP (seeded in `createOrganization`).
- Default `isEnabled: true`.
- Toggling on/off is always allowed; **no template count check** on enable.
- An enabled automation with **0 templates** is valid — the future posting job simply **skips** that type (nothing to render).
- **Later:** send an email when `isEnabled && templateCount === 0` to nudge the club to create a template.

**Why a separate table (not fields on `organizations`)?**

- Avoids bloating the org document and couples toggles to org profile updates.
- Clean index for “all clubs with announcement automation enabled” (future cron).
- Easy to add `starting_eleven` without schema migration on `organizations`.

### 5.3 `automationTemplates`

```ts
automationTemplates: defineTable({
  organizationId: v.id("organizations"),
  automationType: v.union(
    v.literal("match_announcement"),
    v.literal("match_result"),
  ),
  name: v.string(),
  sceneDocument: v.any(), // normalized Konva tree — see §6
  canvasPreset: v.union(
    v.literal("instagram_square"),    // 1080 × 1080
    v.literal("instagram_portrait"),  // 1080 × 1350
    v.literal("facebook_landscape"),  // 1200 × 630
  ),
  schemaVersion: v.number(), // start at 1
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

**Canvas presets (MVP):**

| `canvasPreset` | Width × height | Typical use |
|----------------|----------------|-------------|
| `instagram_square` | 1080 × 1080 | IG feed, FB square posts |
| `instagram_portrait` | 1080 × 1350 | IG portrait |
| `facebook_landscape` | 1200 × 630 | FB link preview style |

`canvasWidth` / `canvasHeight` are **derived** from `canvasPreset` in code (single source of truth). Store only the preset key in the DB.

**Invariants:**

- `automationType` is immutable after create (or: allow change only if bindings remain valid — simpler to forbid edits).
- Hard delete; no `deletedAt`.
- Deleting the last template for a type leaves the automation **enabled**; posting for that type is skipped until a new template is added.

### 5.4 `templateAssets`

Static files uploaded by the club (backgrounds, sponsor logos).

```ts
templateAssets: defineTable({
  organizationId: v.id("organizations"),
  storageId: v.id("_storage"),
  fileName: v.string(),
  mimeType: v.string(),
  byteSize: v.number(),
  uploadedByUserId: v.string(),
  createdAt: v.number(),
})
  .index("by_organizationId", ["organizationId"]);
```

**Not stored here:** home/away club logos (dynamic, from match data at render time).

**Upload flow (future UI):** Convex file upload → insert `templateAssets` row → reference `assetId` on `Image` nodes in the scene.

### 5.5 Seeding automations

Extend `createOrganization` mutation:

```ts
for (const automationType of ["match_announcement", "match_result"] as const) {
  await ctx.db.insert("organizationAutomations", {
    organizationId,
    automationType,
    isEnabled: true,
    updatedAt: Date.now(),
  });
}
```

### 5.6 Access control

All queries/mutations:

1. Authenticate via `authComponent.getAuthUser`.
2. Resolve membership via `getMembershipForUser`.
3. Scope reads/writes to `membership.organizationId`.

No role checks (any member can manage automations and templates).

---

## 6. Template JSON format (`sceneDocument`)

### 6.1 Shape

Store a **parsed object** (not a JSON string) with this top-level structure:

```ts
type SceneDocument = {
  schemaVersion: 1;
  stage: KonvaStageAttrs; // output of stage.toJSON() after normalization
};
```

`stage` follows Konva’s serialized node tree (`className`, `attrs`, `children`).

### 6.2 Normalization pipeline (on save)

Editor calls `stage.toJSON()` → `normalizeSceneDocument(raw)`:

1. **Parse** JSON if string.
2. **Validate** allowed `className` values: `Stage`, `Layer`, `Group`, `Rect`, `Text`, `Image` only.
3. **Strip** editor-only attrs: `draggable`, transformer metadata, selection state, internal ids used only by UI.
4. **Ensure** every `Image` node has exactly one of:
   - `attrs.assetId` — `Id<"templateAssets">` for static uploads
   - `attrs.bindingKey` — dynamic image binding (club logos)
5. **Ensure** every dynamic `Text` node has `attrs.bindingKey`.
6. **Reject** nodes with filters, custom `sceneFunc`, or disallowed class names.
7. **Set** `schemaVersion: 1`.

Shared module: `lib/template-scene/` (used by frontend save and Convex validators).

### 6.3 Variable bindings

Bindings are **`bindingKey` attrs** on Konva nodes, not a separate table.

**Text bindings:**

| `bindingKey` | Automation(s) | Example rendered value (nl-BE) |
|--------------|---------------|--------------------------------|
| `homeClubName` | both | `KFC Dessel Sport` |
| `awayClubName` | both | `KRC Genk` |
| `matchAddress` | both | `Stadionstraat 1, 2480 Dessel` |
| `matchDateTime` | both | `za 15 mrt. 2025, 20:00` |
| `score` | `match_result` only | `2 - 1` |

**Image bindings:**

| `bindingKey` | Automation(s) | Editor placeholder | Render source (future) |
|--------------|---------------|--------------------|-------------------------|
| `homeClubLogo` | both | Generic crest SVG/PNG | Match document |
| `awayClubLogo` | both | Generic crest SVG/PNG | Match document |

**Static images:** `assetId` instead of `bindingKey` on `Image` nodes (backgrounds, sponsors).

**Placeholder content in editor (MVP):**

```ts
const PLACEHOLDER_TEXT: Record<TextBindingKey, string> = {
  homeClubName: "Thuisploeg",
  awayClubName: "Uitploeg",
  matchAddress: "Adres van de wedstrijd",
  matchDateTime: "za 15 mrt. 2025, 20:00",
  score: "2 - 1",
};
```

Use bundled placeholder crest images for `homeClubLogo` / `awayClubLogo` in the designer only.

### 6.4 Why property-panel bindings (not `{{mustache}}` in text)

Target users are club volunteers, not designers. Typing `{{homeClubName}}` inside a text box is error-prone and hard to validate.

**MVP UX:**

1. User adds a **Text** or **Image** element.
2. Inspector shows **“Inhoud”** dropdown: *Vaste tekst* | *Variabele*.
3. If variable → second dropdown lists bindings **allowed for this template’s automation type**.
4. Canvas shows **placeholder** string/image immediately.
5. Optional **“Voorbeeld”** toggle later swaps placeholders for richer sample data.

This maps cleanly to `attrs.bindingKey` in stored JSON and keeps Konva `text` attrs free of template syntax.

### 6.5 Loading in the editor

```ts
const stage = Konva.Node.create(sceneDocument.stage, container);
await hydrateScene(stage, {
  resolveAsset: (assetId) => loadTemplateAssetUrl(assetId),
  resolveBindingImage: (key) => PLACEHOLDER_IMAGES[key],
  resolveBindingText: (key) => PLACEHOLDER_TEXT[key],
});
// Re-attach selection, transformer, drag handlers (not persisted)
```

### 6.6 Server render (future action — design only)

```ts
import Konva from "konva";
import "konva/skia-backend";

const stage = Konva.Node.create(sceneDocument.stage);
await hydrateScene(stage, {
  resolveAsset: (assetId) => loadFromConvexStorage(assetId),
  resolveBindingImage: (key, match) => loadMatchLogo(match, key),
  resolveBindingText: (key, match) => formatBinding(key, match, "nl-BE"),
});
const pngBuffer = await stage.toCanvas().toBuffer("png");
```

Run inside a Convex **`"use node"` action** (skia-canvas is a native Node dependency).

---

## 7. Convex API surface (MVP)

Folder: `convex/automations/` per [convex-structure.md](./convex-structure.md).

### Queries

| Function | Returns | Notes |
|----------|---------|-------|
| `listAutomations` | Both automation rows for current org + template count per type | Dashboard list |
| `listTemplates` | Templates for org, optional filter by `automationType` | Template gallery |
| `getTemplate` | Single template by id | Editor load |

### Mutations

| Function | Behavior |
|----------|----------|
| `setAutomationEnabled` | Sets `isEnabled`; no template count check |
| `createTemplate` | Validates `sceneDocument`, inserts row |
| `updateTemplate` | Re-validates scene, updates `sceneDocument` + `name` |
| `deleteTemplate` | Hard delete; does not change automation `isEnabled` |

Folder: `convex/templateAssets/` (can ship with template editor).

| Function | Behavior |
|----------|----------|
| `generateUploadUrl` | Convex storage upload URL |
| `saveTemplateAsset` | After upload, insert `templateAssets` row |
| `listTemplateAssets` | Assets for current org |
| `deleteTemplateAsset` | Hard delete; **reject** if referenced by any template (or orphan check on save) |

All mutations: auth + org membership check. Success/error → Sonner toasts in UI per [user-feedback rule](../.cursor/rules/user-feedback.mdc).

---

## 8. Frontend routes (MVP, for context)

| Route | Purpose |
|-------|---------|
| `/app/automations` | List automations + enable toggles + link to templates |
| `/app/automations/[type]/templates` | Template list for one automation |
| `/app/automations/[type]/templates/new` | Create template (preset picker → editor) |
| `/app/automations/[type]/templates/[id]/edit` | react-konva editor |

Dependencies to add when implementing editor:

```bash
pnpm add konva react-konva
pnpm add skia-canvas  # server/action only — not bundled to client
```

`react-konva` components must be dynamically imported with `ssr: false` in Next.js.

---

## 9. Enable / disable / delete interaction flows

### Enable / disable automation

```
User toggles ON or OFF
  → mutation sets isEnabled directly
  → no template count check
```

### Delete last template

```
User deletes template
  → delete template row
  → automation stays enabled (isEnabled unchanged)
  → future posting job will skip this type until a new template exists
```

### Active automation without templates (future nudge)

```
Deferred — not MVP
  → detect orgs where isEnabled && templateCount === 0
  → send email reminding club to add a template
  → optional dashboard banner in the automations UI
```

### Random template selection (future posting job)

```
enabled automations for org
  → query templates by organizationId + automationType
  → if length === 0: skip (automation is on but not ready to post)
  → pick index = floor(random() * length)
  → load sceneDocument → render → post
```

---

## 10. `schemaVersion` strategy

Start at **`1`** on every template. The normalizer and loader check `schemaVersion`:

- **v1:** Current Konva-basic subset and binding keys defined in this doc.
- **Future v2+:** Migration function `migrateSceneDocument(doc)` run on read or via one-off backfill before tightening validators.

Even with “no version history” for user edits, **schema version on the document** is not user-facing history — it is forward compatibility for format changes.

---

## 11. What we explicitly defer

| Item | Notes |
|------|-------|
| `starting_eleven` automation | Third row + bindings added later |
| `organizations.federationClubId` | Match/calendar integration TBD |
| Match table & variable resolution | Render pipeline consumes match DTO |
| Posting / scheduling / cron | Convex scheduled functions + actions |
| Social account connections | Meta OAuth |
| Subscription gating | Only block `post` action, not CRUD |
| Thumbnails | `thumbnailStorageId` reserved |
| Watermark layer | Starter plan |
| Template duplication | Nice-to-have |
| Live preview with real fixture data | Static placeholders first |
| Email nudge (active automation, no template) | Remind clubs to create templates |
| Asset reference integrity job | MVP: check on delete; optional background sweep later |

---

## 12. Implementation order

1. **Schema** — add three tables + indexes; seed automations in `createOrganization`.
2. **`lib/template-scene/`** — presets, binding enums, `normalizeSceneDocument`, validators, placeholders.
3. **Convex `automations/`** — queries + mutations (no editor yet).
4. **Convex `templateAssets/`** — upload + list.
5. **Automations dashboard UI** — list, toggles, template counts.
6. **Template editor** — react-konva, preset picker, property panel bindings, save/load.
7. **(Later)** Render action with `konva/skia-backend`.
8. **(Later)** Match data + posting pipeline.

---

## 13. Open questions (non-blocking)

1. **Exact canvas preset list** — confirm the three sizes above are sufficient for MVP or add `1080×1920` story format.
2. **`templateAssets` delete policy** — hard reject delete when referenced vs. cascade remove nodes from templates automatically (recommend: **reject with clear error**).
3. **Org deletion** — when implemented, delete `organizationAutomations`, `automationTemplates`, and `templateAssets` rows + storage blobs in one internal mutation.

---

## 14. Summary

We store **normalized Konva scene JSON** inline on `automationTemplates`, with **`bindingKey`** / **`assetId`** conventions for dynamic vs static content. **react-konva** edits the same document that **Konva + skia-canvas** will render server-side. Automation toggles live in **`organizationAutomations`** (two seeded rows per org, **default on**); posting is skipped when no templates exist. **Later**, email users whose automations are active but still have no templates. Static uploads use **`templateAssets`** + Convex **`_storage`**; club logos are render-time only with editor placeholders.

This is the simplest architecture that satisfies both the editor and backend render requirements without maintaining a custom Canvas 2D interpreter.
