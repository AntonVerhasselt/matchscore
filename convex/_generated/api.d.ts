/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth_deleteUserAccount from "../auth/deleteUserAccount.js";
import type * as auth_instance from "../auth/instance.js";
import type * as auth_queries from "../auth/queries.js";
import type * as automations_actions from "../automations/actions.js";
import type * as automations_constants from "../automations/constants.js";
import type * as automations_helpers from "../automations/helpers.js";
import type * as automations_mutations from "../automations/mutations.js";
import type * as automations_queries from "../automations/queries.js";
import type * as automations_render_hydrate_scene from "../automations/render/hydrate_scene.js";
import type * as automations_render_load_placeholder_crest from "../automations/render/load_placeholder_crest.js";
import type * as automations_render_register_scene_fonts from "../automations/render/register_scene_fonts.js";
import type * as automations_render_render_template_to_png from "../automations/render/render_template_to_png.js";
import type * as automations_scenes from "../automations/scenes.js";
import type * as automations_validators from "../automations/validators.js";
import type * as dev_clearDatabase from "../dev/clearDatabase.js";
import type * as emails_actions from "../emails/actions.js";
import type * as http from "../http.js";
import type * as lib_email from "../lib/email.js";
import type * as lib_slugify from "../lib/slugify.js";
import type * as locales from "../locales.js";
import type * as organizations_helpers from "../organizations/helpers.js";
import type * as organizations_mutations from "../organizations/mutations.js";
import type * as organizations_queries from "../organizations/queries.js";
import type * as templateAssets_constants from "../templateAssets/constants.js";
import type * as templateAssets_helpers from "../templateAssets/helpers.js";
import type * as templateAssets_mutations from "../templateAssets/mutations.js";
import type * as templateAssets_queries from "../templateAssets/queries.js";
import type * as templateAssets_validators from "../templateAssets/validators.js";
import type * as users_emailLocales from "../users/emailLocales.js";
import type * as users_settings from "../users/settings.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "auth/deleteUserAccount": typeof auth_deleteUserAccount;
  "auth/instance": typeof auth_instance;
  "auth/queries": typeof auth_queries;
  "automations/actions": typeof automations_actions;
  "automations/constants": typeof automations_constants;
  "automations/helpers": typeof automations_helpers;
  "automations/mutations": typeof automations_mutations;
  "automations/queries": typeof automations_queries;
  "automations/render/hydrate_scene": typeof automations_render_hydrate_scene;
  "automations/render/load_placeholder_crest": typeof automations_render_load_placeholder_crest;
  "automations/render/register_scene_fonts": typeof automations_render_register_scene_fonts;
  "automations/render/render_template_to_png": typeof automations_render_render_template_to_png;
  "automations/scenes": typeof automations_scenes;
  "automations/validators": typeof automations_validators;
  "dev/clearDatabase": typeof dev_clearDatabase;
  "emails/actions": typeof emails_actions;
  http: typeof http;
  "lib/email": typeof lib_email;
  "lib/slugify": typeof lib_slugify;
  locales: typeof locales;
  "organizations/helpers": typeof organizations_helpers;
  "organizations/mutations": typeof organizations_mutations;
  "organizations/queries": typeof organizations_queries;
  "templateAssets/constants": typeof templateAssets_constants;
  "templateAssets/helpers": typeof templateAssets_helpers;
  "templateAssets/mutations": typeof templateAssets_mutations;
  "templateAssets/queries": typeof templateAssets_queries;
  "templateAssets/validators": typeof templateAssets_validators;
  "users/emailLocales": typeof users_emailLocales;
  "users/settings": typeof users_settings;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  betterAuth: import("@convex-dev/better-auth/_generated/component.js").ComponentApi<"betterAuth">;
  resend: import("@convex-dev/resend/_generated/component.js").ComponentApi<"resend">;
};
