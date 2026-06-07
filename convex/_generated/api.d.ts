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
import type * as dev_clearDatabase from "../dev/clearDatabase.js";
import type * as emails_actions from "../emails/actions.js";
import type * as http from "../http.js";
import type * as lib_email from "../lib/email.js";
import type * as lib_slugify from "../lib/slugify.js";
import type * as locales from "../locales.js";
import type * as organizations_helpers from "../organizations/helpers.js";
import type * as organizations_mutations from "../organizations/mutations.js";
import type * as organizations_queries from "../organizations/queries.js";
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
  "dev/clearDatabase": typeof dev_clearDatabase;
  "emails/actions": typeof emails_actions;
  http: typeof http;
  "lib/email": typeof lib_email;
  "lib/slugify": typeof lib_slugify;
  locales: typeof locales;
  "organizations/helpers": typeof organizations_helpers;
  "organizations/mutations": typeof organizations_mutations;
  "organizations/queries": typeof organizations_queries;
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
