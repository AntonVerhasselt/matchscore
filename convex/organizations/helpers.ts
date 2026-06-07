import { ConvexError } from "convex/values";
import type { GenericDatabaseReader, GenericMutationCtx } from "convex/server";
import type { DataModel, Id } from "../_generated/dataModel";

type DbCtx = {
  db: GenericDatabaseReader<DataModel>;
};
import { normalizeEmail } from "../lib/email";
import { slugifyName } from "../lib/slugify";

export const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export { normalizeEmail };

export function generateInvitationToken(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

export async function generateUniqueSlug(
  ctx: GenericMutationCtx<DataModel>,
  name: string,
): Promise<string> {
  const base = slugifyName(name) || "organisation";
  let slug = base;
  let suffix = 0;

  while (true) {
    const existing = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();

    if (!existing) {
      return slug;
    }

    suffix += 1;
    slug = `${base}-${suffix}`;
  }
}

export async function getMembershipForUser(ctx: DbCtx, userId: string) {
  return await ctx.db
    .query("organizationMembers")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();
}

export async function requireMembership(
  ctx: GenericMutationCtx<DataModel>,
  userId: string,
) {
  const membership = await getMembershipForUser(ctx, userId);
  if (!membership) {
    throw new ConvexError("You are not a member of an organisation");
  }
  return membership;
}

export async function getOrganizationMemberCount(
  ctx: GenericMutationCtx<DataModel>,
  organizationId: Id<"organizations">,
): Promise<number> {
  const members = await ctx.db
    .query("organizationMembers")
    .withIndex("by_organizationId", (q) =>
      q.eq("organizationId", organizationId),
    )
    .collect();

  return members.length;
}

