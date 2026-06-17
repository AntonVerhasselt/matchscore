import { v } from "convex/values";
import { query } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { authComponent } from "../auth/instance";
import { normalizeEmail } from "../lib/email";
import { getMembershipForUser } from "./helpers";

async function resolveOrganizationLogoUrl(
  ctx: Pick<QueryCtx, "db" | "storage">,
  organization: Doc<"organizations">,
): Promise<string | null> {
  const storedLogoUrl = organization.logoImageUrl?.trim();
  if (storedLogoUrl) {
    return storedLogoUrl;
  }

  if (!organization.footballTeamId) {
    return null;
  }

  const team = await ctx.db.get(organization.footballTeamId);
  if (!team?.logoStorageId) {
    return null;
  }

  return (await ctx.storage.getUrl(team.logoStorageId)) ?? null;
}

const memberSummaryValidator = v.object({
  memberId: v.id("organizationMembers"),
  userId: v.string(),
  email: v.string(),
  name: v.union(v.string(), v.null()),
  joinedAt: v.number(),
  isCurrentUser: v.boolean(),
});

const pendingInvitationValidator = v.object({
  invitationId: v.id("organizationInvitations"),
  email: v.string(),
  createdAt: v.number(),
  expiresAt: v.number(),
});

export const hasOrganization = query({
  args: {},
  returns: v.boolean(),
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) {
      return false;
    }

    const membership = await getMembershipForUser(ctx, user._id);
    return membership !== null;
  },
});

export const getCurrentMembership = query({
  args: {},
  returns: v.union(
    v.object({
      organization: v.object({
        _id: v.id("organizations"),
        name: v.string(),
        slug: v.string(),
        logoImageUrl: v.union(v.string(), v.null()),
        footballTeamId: v.optional(v.id("footballTeams")),
        createdAt: v.number(),
      }),
      members: v.array(memberSummaryValidator),
    }),
    v.null(),
  ),
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) {
      return null;
    }

    const membership = await getMembershipForUser(ctx, user._id);
    if (!membership) {
      return null;
    }

    const organization = await ctx.db.get(membership.organizationId);
    if (!organization) {
      return null;
    }

    const memberRows = await ctx.db
      .query("organizationMembers")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", organization._id),
      )
      .collect();

    const members = await Promise.all(
      memberRows.map(async (member) => {
        const authUser = await authComponent.getAnyUserById(ctx, member.userId);
        return {
          memberId: member._id,
          userId: member.userId,
          email: authUser?.email ?? "",
          name: authUser?.name ?? null,
          joinedAt: member.joinedAt,
          isCurrentUser: member.userId === user._id,
        };
      }),
    );

    return {
      organization: {
        _id: organization._id,
        name: organization.name,
        slug: organization.slug,
        logoImageUrl: await resolveOrganizationLogoUrl(ctx, organization),
        footballTeamId: organization.footballTeamId,
        createdAt: organization.createdAt,
      },
      members,
    };
  },
});

export const listPendingInvitations = query({
  args: {},
  returns: v.array(pendingInvitationValidator),
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) {
      return [];
    }

    const membership = await getMembershipForUser(ctx, user._id);
    if (!membership) {
      return [];
    }

    const now = Date.now();
    const invitations = await ctx.db
      .query("organizationInvitations")
      .withIndex("by_organizationId_and_status", (q) =>
        q.eq("organizationId", membership.organizationId).eq("status", "pending"),
      )
      .collect();

    return invitations
      .filter((invitation) => invitation.expiresAt > now)
      .map((invitation) => ({
        invitationId: invitation._id,
        email: invitation.email,
        createdAt: invitation.createdAt,
        expiresAt: invitation.expiresAt,
      }));
  },
});

export const getInvitationByToken = query({
  args: {
    token: v.string(),
  },
  returns: v.union(
    v.object({
      organizationName: v.string(),
      email: v.string(),
      expired: v.boolean(),
      status: v.union(
        v.literal("pending"),
        v.literal("accepted"),
        v.literal("cancelled"),
      ),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const invitation = await ctx.db
      .query("organizationInvitations")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();

    if (!invitation) {
      return null;
    }

    const organization = await ctx.db.get(invitation.organizationId);
    if (!organization) {
      return null;
    }

    return {
      organizationName: organization.name,
      email: invitation.email,
      expired: invitation.expiresAt <= Date.now(),
      status: invitation.status,
    };
  },
});

export const getPendingInvitationForEmail = query({
  args: {
    email: v.string(),
  },
  returns: v.union(
    v.object({
      token: v.string(),
      organizationName: v.string(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const normalizedEmail = normalizeEmail(args.email);
    const invitation = await ctx.db
      .query("organizationInvitations")
      .withIndex("by_email_and_status", (q) =>
        q.eq("email", normalizedEmail).eq("status", "pending"),
      )
      .first();

    if (!invitation || invitation.expiresAt <= Date.now()) {
      return null;
    }

    const organization = await ctx.db.get(invitation.organizationId);
    if (!organization) {
      return null;
    }

    return {
      token: invitation.token,
      organizationName: organization.name,
    };
  },
});
