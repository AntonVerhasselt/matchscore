import { ConvexError, v } from "convex/values";
import { components } from "../_generated/api";
import { internalMutation, type MutationCtx } from "../_generated/server";

const appTables = [
  "organizationInvitations",
  "organizationMembers",
  "organizations",
  "userSettings",
  "pendingEmailLocales",
] as const;

const authModels = [
  "session",
  "account",
  "verification",
  "twoFactor",
  "user",
] as const;

const paginationOpts = {
  cursor: null,
  numItems: 500,
} as const;

async function deleteAllFromTable(
  ctx: MutationCtx,
  table: (typeof appTables)[number],
) {
  const rows = await ctx.db.query(table).collect();
  for (const row of rows) {
    await ctx.db.delete(row._id);
  }
  return rows.length;
}

async function deleteAllAuthModel(ctx: MutationCtx, model: (typeof authModels)[number]) {
  let total = 0;

  while (true) {
    const result: { count?: number } = await ctx.runMutation(
      components.betterAuth.adapter.deleteMany,
      {
        input: { model },
        paginationOpts,
      },
    );

    const deleted = result?.count ?? 0;
    total += deleted;
    if (deleted === 0) {
      break;
    }
  }

  return total;
}

/**
 * Dev-only: wipe app data and all Better Auth users/sessions.
 * Run: npx convex run dev/clearDatabase:clearAll
 */
export const clearAll = internalMutation({
  args: {},
  returns: v.object({
    appTables: v.record(v.string(), v.number()),
    authModels: v.record(v.string(), v.number()),
  }),
  handler: async (ctx) => {
    const deployment = process.env.CONVEX_DEPLOYMENT ?? "";
    const isDevDeployment =
      deployment.startsWith("dev:") || deployment.includes(":dev");
    if (!isDevDeployment) {
      throw new ConvexError(
        "clearAll is blocked outside development deployments",
      );
    }

    const appCounts: Record<string, number> = {};
    for (const table of appTables) {
      appCounts[table] = await deleteAllFromTable(ctx, table);
    }

    const authCounts: Record<string, number> = {};
    for (const model of authModels) {
      authCounts[model] = await deleteAllAuthModel(ctx, model);
    }

    return { appTables: appCounts, authModels: authCounts };
  },
});
