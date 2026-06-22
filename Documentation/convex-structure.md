# Convex folder structure

Matchscore groups Convex functions by feature domain. Folders map to API namespaces.

## Layout

```text
convex/
├── schema.ts                  # Schema definition (root only)
├── convex.config.ts           # Component registration (root only)
├── auth.config.ts             # Convex auth provider config (root only)
├── http.ts                    # HTTP router entry (root only)
├── locales.ts                 # Shared validators/types
│
├── auth/
│   ├── instance.ts            # authComponent, createAuth
│   ├── queries.ts             # getCurrentUser
│   └── deleteUserAccount.ts   # Internal: hard-delete Better Auth user
│
├── users/
│   ├── settings.ts            # userSettings (locale CRUD)
│   └── emailLocales.ts        # pendingEmailLocales (pre-auth email locale)
│
├── organizations/
│   ├── queries.ts             # Membership and invitation queries
│   ├── mutations.ts           # Organisation lifecycle mutations
│   └── helpers.ts             # Pure helpers (no Convex exports)
│
├── emails/
│   └── actions.ts             # Resend email actions
│
├── automations/
│   ├── queries.ts             # listAutomations, listTemplates, getTemplate
│   ├── mutations.ts           # Automation toggles, template CRUD
│   ├── actions.ts             # "use node" — renderTemplateTest, generateTemplateThumbnail
│   ├── internalQueries.ts     # Template row for scheduled thumbnail render
│   ├── internalMutations.ts   # Render preview + thumbnail blob cleanup
│   ├── thumbnailConstants.ts  # Debounce delay and JPEG export settings
│   ├── helpers.ts             # Membership, ensureOrganizationAutomations
│   ├── scenes.ts              # Starter scene documents
│   ├── cleanup.ts             # deleteOrganizationAutomationData (future org delete)
│   └── render/                # "use node" — skia-canvas render pipeline
│
├── templateAssets/
│   ├── queries.ts             # listTemplateAssets, asset reference checks
│   ├── internalQueries.ts     # Org-scoped asset storage ids for server render
│   └── mutations.ts           # Upload URL, save, delete assets
│
├── veoPosts/
│   ├── queries.ts             # listJobs, getJob
│   ├── mutations.ts           # updateDraftCaption, setPostingChannelEnabled, deleteJob
│   ├── actions.ts             # "use node" — createOrOpenJob, regenerateJob
│   ├── internalQueries.ts     # Dedupe plan, processing/regeneration lookups
│   ├── internalMutations.ts   # Pipeline state, expiry cron
│   ├── internalActions.ts     # "use node" — VGF webhook + poll fallback
│   ├── helpers.ts             # Veo client, goal filter, dedupe
│   ├── vgfHelpers.ts          # FFmpeg command builder, webhook URL
│   ├── vgfClient.ts           # "use node" — VGF SDK submit
│   ├── downloadVgfOutputToR2.ts # "use node" — stream VGF output to Cloudflare R2
│   ├── r2Client.ts              # @convex-dev/r2 client for goal highlights
│   ├── access.ts              # Org-scoped job access
│   └── validators.ts
│
├── billing/
│   ├── queries.ts             # getOrgBillingState, getOrgBillingContext, needsPlanSelection
│   ├── mutations.ts           # skipBillingOnboarding
│   ├── actions.ts             # "use node" — Checkout, Customer Portal, Stripe sync
│   ├── internalQueries.ts     # Checkout/portal context, org lookup by customer ID
│   ├── internalMutations.ts   # syncOrganizationBilling
│   ├── webhookHandlers.ts     # Stripe event → org billing patch
│   ├── access.ts              # requireOrgFeature
│   ├── stripeCatalog.ts       # Price and tax rate IDs (test/live)
│   ├── helpers.ts             # VAT, subscription status mapping
│   ├── types.ts
│   └── validators.ts
│
└── lib/                       # Pure TypeScript helpers (no Convex exports)
    ├── email.ts
    ├── features.ts            # Plan → feature matrix (billing gating)
    ├── features.test.ts
    └── slugify.ts
```

## API paths

Convex maps file paths to API references:

| File                         | Example API path                                 |
| ---------------------------- | ------------------------------------------------ |
| `users/settings.ts`          | `api.users.settings.getUserLocale`               |
| `auth/queries.ts`            | `api.auth.queries.getCurrentUser`                |
| `organizations/mutations.ts` | `api.organizations.mutations.createOrganization` |
| `emails/actions.ts`          | `internal.emails.actions.sendOtpEmail`           |
| `veoPosts/queries.ts`        | `api.veoPosts.queries.listJobs`                  |
| `veoPosts/actions.ts`        | `api.veoPosts.actions.createOrOpenJob`           |
| `billing/queries.ts`         | `api.billing.queries.getOrgBillingContext`       |
| `billing/actions.ts`         | `api.billing.actions.createCustomerPortalSession` |

See [stripe-billing.md](./stripe-billing.md) for billing architecture and flows.

## Conventions

1. **Feature folders** — one folder per domain (`users/`, `organizations/`, `auth/`, `emails/`). New features get their own folder.
2. **Root-only files** — keep `schema.ts`, `convex.config.ts`, `auth.config.ts`, and `http.ts` at the `convex/` root.
3. **File size** — aim for **≤150 lines** per Convex function file. Split into `queries.ts`, `mutations.ts`, or `actions.ts` when a module grows beyond that.
4. **`helpers.ts`** — business logic and shared checks only; no `query`/`mutation`/`action` exports.
5. **Cross-cutting code** — validators used by multiple features stay at root (`locales.ts`) or in `convex/lib/`.
6. **Naming** — folder = plural domain name; file = responsibility (`queries`, `mutations`, `settings`).

## Adding a new feature

1. Create a folder under `convex/` (e.g. `convex/automations/`).
2. Add tables to `convex/schema.ts`.
3. Split functions across `queries.ts`, `mutations.ts`, and `helpers.ts` as needed.
4. Use `authComponent.safeGetAuthUser` / `getAuthUser` for authenticated endpoints.
5. Add return validators on all public functions.
