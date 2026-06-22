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
import type * as automations_cleanup from "../automations/cleanup.js";
import type * as automations_constants from "../automations/constants.js";
import type * as automations_helpers from "../automations/helpers.js";
import type * as automations_internalMutations from "../automations/internalMutations.js";
import type * as automations_internalQueries from "../automations/internalQueries.js";
import type * as automations_mutations from "../automations/mutations.js";
import type * as automations_queries from "../automations/queries.js";
import type * as automations_render_hydrate_scene from "../automations/render/hydrate_scene.js";
import type * as automations_render_load_placeholder_crest from "../automations/render/load_placeholder_crest.js";
import type * as automations_render_register_scene_fonts from "../automations/render/register_scene_fonts.js";
import type * as automations_render_render_template_to_png from "../automations/render/render_template_to_png.js";
import type * as automations_render_run_template_render from "../automations/render/run_template_render.js";
import type * as automations_scenes from "../automations/scenes.js";
import type * as automations_thumbnailConstants from "../automations/thumbnailConstants.js";
import type * as automations_validators from "../automations/validators.js";
import type * as billing_actions from "../billing/actions.js";
import type * as billing_helpers from "../billing/helpers.js";
import type * as billing_internalMutations from "../billing/internalMutations.js";
import type * as billing_internalQueries from "../billing/internalQueries.js";
import type * as billing_mutations from "../billing/mutations.js";
import type * as billing_queries from "../billing/queries.js";
import type * as billing_stripeCatalog from "../billing/stripeCatalog.js";
import type * as billing_types from "../billing/types.js";
import type * as billing_validators from "../billing/validators.js";
import type * as billing_webhookHandlers from "../billing/webhookHandlers.js";
import type * as crons from "../crons.js";
import type * as dev_clearDatabase from "../dev/clearDatabase.js";
import type * as dev_deploymentGuard from "../dev/deploymentGuard.js";
import type * as dev_seedFootballTeam from "../dev/seedFootballTeam.js";
import type * as emails_actions from "../emails/actions.js";
import type * as football_actions from "../football/actions.js";
import type * as football_helpers from "../football/helpers.js";
import type * as football_importClubPage from "../football/importClubPage.js";
import type * as football_internalActions from "../football/internalActions.js";
import type * as football_internalMutations from "../football/internalMutations.js";
import type * as football_internalQueries from "../football/internalQueries.js";
import type * as football_logoImport from "../football/logoImport.js";
import type * as football_queries from "../football/queries.js";
import type * as football_runSyncCompetition from "../football/runSyncCompetition.js";
import type * as football_syncActions from "../football/syncActions.js";
import type * as football_templateRenderMatchHelpers from "../football/templateRenderMatchHelpers.js";
import type * as football_validators from "../football/validators.js";
import type * as http from "../http.js";
import type * as lib_email from "../lib/email.js";
import type * as lib_features from "../lib/features.js";
import type * as lib_slugify from "../lib/slugify.js";
import type * as lib_voetbalinbelgie_allowlist from "../lib/voetbalinbelgie/allowlist.js";
import type * as lib_voetbalinbelgie_disambiguateTeamNames from "../lib/voetbalinbelgie/disambiguateTeamNames.js";
import type * as lib_voetbalinbelgie_matchIdentity from "../lib/voetbalinbelgie/matchIdentity.js";
import type * as lib_voetbalinbelgie_matchMerge from "../lib/voetbalinbelgie/matchMerge.js";
import type * as lib_voetbalinbelgie_parseCompetition from "../lib/voetbalinbelgie/parseCompetition.js";
import type * as lib_voetbalinbelgie_parseHtml from "../lib/voetbalinbelgie/parseHtml.js";
import type * as lib_voetbalinbelgie_syncSchedule from "../lib/voetbalinbelgie/syncSchedule.js";
import type * as lib_voetbalinbelgie_teamNames from "../lib/voetbalinbelgie/teamNames.js";
import type * as lib_voetbalinbelgie_types from "../lib/voetbalinbelgie/types.js";
import type * as lib_voetbalinbelgie_vibMatchKey from "../lib/voetbalinbelgie/vibMatchKey.js";
import type * as locales from "../locales.js";
import type * as organizations_helpers from "../organizations/helpers.js";
import type * as organizations_mutations from "../organizations/mutations.js";
import type * as organizations_queries from "../organizations/queries.js";
import type * as templateAssets_constants from "../templateAssets/constants.js";
import type * as templateAssets_helpers from "../templateAssets/helpers.js";
import type * as templateAssets_internalQueries from "../templateAssets/internalQueries.js";
import type * as templateAssets_mutations from "../templateAssets/mutations.js";
import type * as templateAssets_queries from "../templateAssets/queries.js";
import type * as templateAssets_validators from "../templateAssets/validators.js";
import type * as users_emailLocales from "../users/emailLocales.js";
import type * as users_settings from "../users/settings.js";
import type * as veoPosts_access from "../veoPosts/access.js";
import type * as veoPosts_actions from "../veoPosts/actions.js";
import type * as veoPosts_convexSiteUrl from "../veoPosts/convexSiteUrl.js";
import type * as veoPosts_downloadVgfOutputToR2 from "../veoPosts/downloadVgfOutputToR2.js";
import type * as veoPosts_helpers from "../veoPosts/helpers.js";
import type * as veoPosts_internalActions from "../veoPosts/internalActions.js";
import type * as veoPosts_internalMutations from "../veoPosts/internalMutations.js";
import type * as veoPosts_internalQueries from "../veoPosts/internalQueries.js";
import type * as veoPosts_mutations from "../veoPosts/mutations.js";
import type * as veoPosts_queries from "../veoPosts/queries.js";
import type * as veoPosts_r2Client from "../veoPosts/r2Client.js";
import type * as veoPosts_validators from "../veoPosts/validators.js";
import type * as veoPosts_vgfClient from "../veoPosts/vgfClient.js";
import type * as veoPosts_vgfHelpers from "../veoPosts/vgfHelpers.js";
import type * as voetbalinbelgie_fetch from "../voetbalinbelgie/fetch.js";
import type * as voetbalinbelgie_logos from "../voetbalinbelgie/logos.js";

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
  "automations/cleanup": typeof automations_cleanup;
  "automations/constants": typeof automations_constants;
  "automations/helpers": typeof automations_helpers;
  "automations/internalMutations": typeof automations_internalMutations;
  "automations/internalQueries": typeof automations_internalQueries;
  "automations/mutations": typeof automations_mutations;
  "automations/queries": typeof automations_queries;
  "automations/render/hydrate_scene": typeof automations_render_hydrate_scene;
  "automations/render/load_placeholder_crest": typeof automations_render_load_placeholder_crest;
  "automations/render/register_scene_fonts": typeof automations_render_register_scene_fonts;
  "automations/render/render_template_to_png": typeof automations_render_render_template_to_png;
  "automations/render/run_template_render": typeof automations_render_run_template_render;
  "automations/scenes": typeof automations_scenes;
  "automations/thumbnailConstants": typeof automations_thumbnailConstants;
  "automations/validators": typeof automations_validators;
  "billing/actions": typeof billing_actions;
  "billing/helpers": typeof billing_helpers;
  "billing/internalMutations": typeof billing_internalMutations;
  "billing/internalQueries": typeof billing_internalQueries;
  "billing/mutations": typeof billing_mutations;
  "billing/queries": typeof billing_queries;
  "billing/stripeCatalog": typeof billing_stripeCatalog;
  "billing/types": typeof billing_types;
  "billing/validators": typeof billing_validators;
  "billing/webhookHandlers": typeof billing_webhookHandlers;
  crons: typeof crons;
  "dev/clearDatabase": typeof dev_clearDatabase;
  "dev/deploymentGuard": typeof dev_deploymentGuard;
  "dev/seedFootballTeam": typeof dev_seedFootballTeam;
  "emails/actions": typeof emails_actions;
  "football/actions": typeof football_actions;
  "football/helpers": typeof football_helpers;
  "football/importClubPage": typeof football_importClubPage;
  "football/internalActions": typeof football_internalActions;
  "football/internalMutations": typeof football_internalMutations;
  "football/internalQueries": typeof football_internalQueries;
  "football/logoImport": typeof football_logoImport;
  "football/queries": typeof football_queries;
  "football/runSyncCompetition": typeof football_runSyncCompetition;
  "football/syncActions": typeof football_syncActions;
  "football/templateRenderMatchHelpers": typeof football_templateRenderMatchHelpers;
  "football/validators": typeof football_validators;
  http: typeof http;
  "lib/email": typeof lib_email;
  "lib/features": typeof lib_features;
  "lib/slugify": typeof lib_slugify;
  "lib/voetbalinbelgie/allowlist": typeof lib_voetbalinbelgie_allowlist;
  "lib/voetbalinbelgie/disambiguateTeamNames": typeof lib_voetbalinbelgie_disambiguateTeamNames;
  "lib/voetbalinbelgie/matchIdentity": typeof lib_voetbalinbelgie_matchIdentity;
  "lib/voetbalinbelgie/matchMerge": typeof lib_voetbalinbelgie_matchMerge;
  "lib/voetbalinbelgie/parseCompetition": typeof lib_voetbalinbelgie_parseCompetition;
  "lib/voetbalinbelgie/parseHtml": typeof lib_voetbalinbelgie_parseHtml;
  "lib/voetbalinbelgie/syncSchedule": typeof lib_voetbalinbelgie_syncSchedule;
  "lib/voetbalinbelgie/teamNames": typeof lib_voetbalinbelgie_teamNames;
  "lib/voetbalinbelgie/types": typeof lib_voetbalinbelgie_types;
  "lib/voetbalinbelgie/vibMatchKey": typeof lib_voetbalinbelgie_vibMatchKey;
  locales: typeof locales;
  "organizations/helpers": typeof organizations_helpers;
  "organizations/mutations": typeof organizations_mutations;
  "organizations/queries": typeof organizations_queries;
  "templateAssets/constants": typeof templateAssets_constants;
  "templateAssets/helpers": typeof templateAssets_helpers;
  "templateAssets/internalQueries": typeof templateAssets_internalQueries;
  "templateAssets/mutations": typeof templateAssets_mutations;
  "templateAssets/queries": typeof templateAssets_queries;
  "templateAssets/validators": typeof templateAssets_validators;
  "users/emailLocales": typeof users_emailLocales;
  "users/settings": typeof users_settings;
  "veoPosts/access": typeof veoPosts_access;
  "veoPosts/actions": typeof veoPosts_actions;
  "veoPosts/convexSiteUrl": typeof veoPosts_convexSiteUrl;
  "veoPosts/downloadVgfOutputToR2": typeof veoPosts_downloadVgfOutputToR2;
  "veoPosts/helpers": typeof veoPosts_helpers;
  "veoPosts/internalActions": typeof veoPosts_internalActions;
  "veoPosts/internalMutations": typeof veoPosts_internalMutations;
  "veoPosts/internalQueries": typeof veoPosts_internalQueries;
  "veoPosts/mutations": typeof veoPosts_mutations;
  "veoPosts/queries": typeof veoPosts_queries;
  "veoPosts/r2Client": typeof veoPosts_r2Client;
  "veoPosts/validators": typeof veoPosts_validators;
  "veoPosts/vgfClient": typeof veoPosts_vgfClient;
  "veoPosts/vgfHelpers": typeof veoPosts_vgfHelpers;
  "voetbalinbelgie/fetch": typeof voetbalinbelgie_fetch;
  "voetbalinbelgie/logos": typeof voetbalinbelgie_logos;
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
  r2: import("@convex-dev/r2/_generated/component.js").ComponentApi<"r2">;
  stripe: import("@convex-dev/stripe/_generated/component.js").ComponentApi<"stripe">;
};
