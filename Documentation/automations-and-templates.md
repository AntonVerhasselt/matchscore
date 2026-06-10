# Automations & templates

Matchscore helps Belgian amateur football clubs automate social media posts. Each registered **club** (stored as an `organization` in code and the database) can:

1. Design visual **templates** for automated posts.
2. Toggle **automations** on or off per post type and per social channel.
3. *(Future)* Connect social accounts so Matchscore picks a template, fills match variables, renders a PNG, and publishes it.

The template editor and automation settings are fully implemented for MVP. Scheduled posting, real match data, and social OAuth are **not** implemented yet.

---

## Automation types

Two automation types exist in MVP:

| Backend `automationType` | URL slug | User-facing purpose | Future trigger |
| --- | --- | --- | --- |
| `match_result` | `result` | Final score visual | When the federation publishes a result |
| `match_announcement` | `preview` | Match preview / announcement | ~2 days before kick-off |

URL slugs live under `/app/automations/`. Mapping helpers are in `lib/automations/types.ts`:

```ts
result  → match_result
preview → match_announcement
```

**Deferred:** `starting_eleven` and any additional automation types.

---

## Architecture overview

Templates are **normalized Konva scene JSON** stored inline on each `automationTemplates` row. The same JSON is:

- Edited in the browser with **react-konva** (client-only, dynamically imported).
- Rendered server-side with **Konva + skia-canvas** in Convex `"use node"` actions.

Static club uploads (backgrounds, sponsor logos) live in Convex Storage and are referenced by `assetId` on `Image` nodes. Dynamic match content (club names, score, logos) is stored as `bindingKey` attrs and resolved at render time.

See [template-editor.md](./template-editor.md) for scene format, editor internals, and the render pipeline.

---

## Data model

```
organizations
  ├── organizationAutomations   (1 row per automation type)
  ├── automationTemplates       (0..N per type)
  └── templateAssets            (static image uploads)
```

### `organizationAutomations`

One row per organization per automation type. Rows are created when an organization is created (`convex/organizations/mutations.ts` → `ensureOrganizationAutomations`).

| Field | Description |
| --- | --- |
| `isGloballyEnabled` | Master switch for this automation type. Defaults to `true`. |
| `postingChannels` | Per-channel preferences: Facebook page post/story, Instagram profile post/story. All default to `true`. |
| `updatedAt`, `updatedByUserId` | Audit fields on toggle mutations. |

**Behavior:**

- Users can enable/disable globally and per channel without needing templates.
- When `isGloballyEnabled` is `false`, **effective** channel status is `false` for every channel, but stored per-channel preferences are preserved for re-enable.
- An enabled automation with **zero templates** is valid. A future posting job will skip that type until a template exists.
- Deleting the last template does **not** disable the automation.

### `automationTemplates`

| Field | Description |
| --- | --- |
| `name` | Display name in the template list. |
| `automationType` | `match_announcement` or `match_result` (immutable after create). |
| `canvasPreset` | `instagram_square`, `instagram_portrait`, or `facebook_landscape`. |
| `sceneDocument` | Parsed Konva scene JSON (`schemaVersion: 1`). |
| `schemaVersion` | Format version (currently `1`). |
| `lastRenderPreviewStorageId` | Latest render-test PNG in `_storage`; previous blob is deleted on each test. |
| `thumbnailStorageId` | Optional; reserved for future thumbnails. |

Canvas dimensions are derived from `canvasPreset` in code, not stored separately:

| Preset | Size | Typical use |
| --- | --- | --- |
| `instagram_square` | 1080 × 1080 | Instagram feed, square Facebook posts |
| `instagram_portrait` | 1080 × 1350 | Instagram portrait |
| `facebook_landscape` | 1200 × 630 | Facebook landscape / link-style visual |

Templates are hard-deleted. Deleting a template also removes associated render-preview and thumbnail blobs from `_storage`.

### `templateAssets`

Static images uploaded by the club (PNG, JPEG, WebP only; max 8 MB).

| Field | Description |
| --- | --- |
| `storageId` | Convex `_storage` reference (durable; signed URLs generated at read time). |
| `fileName`, `mimeType`, `byteSize` | File metadata. |
| `pixelWidth`, `pixelHeight` | Intrinsic dimensions for editor insertion. |

Club logos for home/away teams are **not** stored here. They are dynamic bindings resolved from match data at render time.

**Delete policy:** `deleteTemplateAsset` returns `{ status: "inUse" }` if any template in the organization still references the asset via `attrs.assetId`.

---

## Convex API

Functions follow the feature-folder layout described in [convex-structure.md](./convex-structure.md).

### `convex/automations/`

| Function | Type | Purpose |
| --- | --- | --- |
| `queries.listAutomations` | query | Both automation rows + template counts + effective channel status |
| `queries.listTemplates` | query | Templates for current org, optional filter by `automationType` |
| `queries.getTemplate` | query | Single template including `sceneDocument` |
| `mutations.ensureCurrentOrganizationAutomations` | mutation | Idempotent backfill for orgs created before automations shipped |
| `mutations.setAutomationGlobalEnabled` | mutation | Toggle `isGloballyEnabled` |
| `mutations.setAutomationPostingChannelEnabled` | mutation | Toggle one posting channel |
| `mutations.createTemplate` | mutation | Insert template with starter scene |
| `mutations.updateTemplate` | mutation | Validate + normalize scene, update name |
| `mutations.deleteTemplate` | mutation | Hard delete + cleanup storage blobs |
| `actions.renderTemplateTest` | action (`"use node"`) | Render current or saved scene to PNG; returns signed preview URL |
| `internalMutations.replaceTemplateRenderPreview` | internal | Stores new preview blob, deletes previous |

All public functions authenticate via Better Auth, resolve organization membership server-side, and scope reads/writes to `membership.organizationId`. Never accept a client-supplied organization id for authorization.

Scene validation runs through `normalizeSceneDocument` in `lib/template-scene/` on both client save and server mutations.

### `convex/templateAssets/`

| Function | Type | Purpose |
| --- | --- | --- |
| `mutations.generateUploadUrl` | mutation | Convex Storage upload URL |
| `mutations.saveTemplateAsset` | mutation | Insert asset row after upload (validates mime/size) |
| `queries.listTemplateAssets` | query | Org assets with signed URLs |
| `mutations.deleteTemplateAsset` | mutation | Delete if unreferenced |
| `queries.assertSceneDocumentAssetReferences` | query | Validates all `assetId` refs belong to caller's org |

### Organization cleanup

`convex/automations/cleanup.ts` exports `deleteOrganizationAutomationData()` to remove automation rows, templates, assets, and storage blobs for an organization. It is ready to call from a future `deleteOrganization` mutation but is **not wired yet**.

---

## Routes & UI

| Route | Page | Purpose |
| --- | --- | --- |
| `/app/automations` | `app/app/automations/page.tsx` | Overview: automation cards, global + channel toggles, template counts |
| `/app/automations/[automationType]` | `app/app/automations/[automationType]/page.tsx` | Template list for `result` or `preview` |
| `/app/automations/[automationType]/[templateId]` | `app/app/automations/[automationType]/[templateId]/page.tsx` | Template editor |

The editor route dynamically imports `TemplateEditorRoot` with `{ ssr: false }`. The editor requires a viewport width of at least **1024px** (`lg` breakpoint); smaller viewports show a “use a larger screen” message.

### Key UI components

| Area | Location |
| --- | --- |
| Automation overview cards | `components/automations/automation-type-card.tsx` |
| Template list + empty state | `components/automations/template-list.tsx` |
| Create template | `components/automations/create-template-button.tsx` |
| Delete template dialog | `components/automations/delete-template-dialog.tsx` |
| Template editor shell | `components/template-editor/template-editor-root.tsx` |
| Editor canvas + panels | `components/template-editor/static-template-editor.tsx` |

Copy is translated via `next-intl` (`messages/*.json`, namespace `app.automations`). User-facing text says “club”; code uses `organization`.

User actions show success/error feedback with Sonner toasts via `@/lib/user-feedback`.

---

## User flows

### Enable or disable an automation

1. User toggles global switch or a Facebook/Instagram channel switch on `/app/automations`.
2. Mutation updates `organizationAutomations`.
3. Toast confirms success or failure.

No template count check runs on enable. When globally disabled, channel switches appear off in the UI but stored channel preferences remain.

### Create a template

1. User opens an automation type page and clicks create.
2. `createTemplate` inserts a row with a starter scene for the chosen canvas preset.
3. User is routed to the editor.

### Edit and save

1. Editor loads `getTemplate` and hydrates images from signed URLs / binding placeholders.
2. Changes are tracked as dirty state; **autosave** runs after 2.5 s idle (`hooks/use-template-autosave.ts`).
3. Manual save (toolbar button or Cmd/Ctrl+S) also calls `updateTemplate`.
4. `beforeunload` warns if there are unsaved changes.

### Delete a template

1. User deletes from the template list dialog.
2. Row and associated preview/thumbnail blobs are removed.
3. Automation `isGloballyEnabled` is unchanged.

### Render test

1. User clicks **Render test** in the editor toolbar.
2. `renderTemplateTest` receives the **current canvas** (`sceneDocument` override) plus `templateId`.
3. Server normalizes, registers fonts, hydrates bindings with mock match data, exports PNG.
4. PNG is stored in `_storage`; a dialog shows the signed URL.

Production posting will render the **saved** template row only (no live canvas override).

---

## Variable bindings (summary)

Dynamic content uses `attrs.bindingKey` on Konva nodes — not `{{mustache}}` syntax in text. Users configure bindings through the property panel (“Inhoud” dropdown).

**Text bindings:** `homeClubName`, `awayClubName`, `homeAwayClubNames`, `matchAddress`, `matchDateTime`, `score` (result only).

**Image bindings:** `homeClubLogo`, `awayClubLogo`.

Full binding rules, placeholder values, and validation are documented in [template-editor.md](./template-editor.md).

---

## Access control

Any organization member can manage automations and templates. There are no role checks beyond membership.

All queries and mutations derive the organization from the authenticated user's membership — never from client-supplied ids.

---

## Testing

Automated coverage lives in:

- `convex/automations/scenes.test.ts` — scene normalization, bindings, shapes, text fit
- `convex/automations/render/render.test.ts` — server render, fonts, crest placeholders

Useful scripts:

```bash
pnpm sync-template-fonts    # Regenerate server font URL manifest after catalog changes
pnpm test:template-render   # Local skia-canvas smoke test
```

---

## Deferred (post-MVP)

| Area | Notes |
| --- | --- |
| `starting_eleven` automation | Third automation type |
| Match / calendar tables | Real fixture data for bindings |
| Posting pipeline | Cron, random template pick, Meta/social APIs |
| Social OAuth | Connect Facebook/Instagram accounts |
| Subscription gating | Block posting only; editing stays allowed |
| Email nudge | Remind clubs with active automations but no templates |
| Template thumbnails | `thumbnailStorageId` field exists but unused |
| Template duplication | Nice-to-have |
| Watermark layer | Starter plan feature |
| Club-uploaded custom fonts | Only curated Google Fonts catalog today |
| Org deletion wiring | `deleteOrganizationAutomationData` helper exists |
| `selectRandomTemplate` helper | For future posting job |

---

## Related documentation

- [template-editor.md](./template-editor.md) — Scene format, editor architecture, server render
- [convex-structure.md](./convex-structure.md) — Convex folder conventions
- [organisations.md](./organisations.md) — Organization membership model
