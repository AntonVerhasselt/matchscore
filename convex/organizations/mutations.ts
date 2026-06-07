import type { MutationCtx } from "../_generated/server";
import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import { mutation } from "../_generated/server";
import { authComponent } from "../auth/instance";
import { normalizeEmail } from "../lib/email";
import { getUserDisplayName } from "../../lib/user-display";
import {
  generateInvitationToken,
  generateUniqueSlug,
  getMembershipForUser,
  getOrganizationMemberCount,
  INVITATION_TTL_MS,
  requireMembership,
} from "./helpers";

const siteUrl = process.env.SITE_URL!;

async function acceptInvitationForUser(
  ctx: MutationCtx,
  user: { _id: string; email: string },
  token: string,
) {
  const invitation = await ctx.db
    .query("organizationInvitations")
    .withIndex("by_token", (q) => q.eq("token", token))
    .unique();

  if (!invitation) {
    throw new ConvexError("Invitation not found");
  }

  if (invitation.status !== "pending") {
    throw new ConvexError("Invitation is no longer valid");
  }

  if (invitation.expiresAt <= Date.now()) {
    throw new ConvexError("Invitation has expired");
  }

  if (normalizeEmail(user.email) !== invitation.email) {
    throw new ConvexError(
      "Sign in with the email address that received the invitation",
    );
  }

  const existingMembership = await getMembershipForUser(ctx, user._id);
  if (existingMembership) {
    throw new ConvexError("You already belong to an organisation");
  }

  const emailMember = await findMemberByEmail(ctx, invitation.email);
  if (emailMember) {
    throw new ConvexError("This email address already belongs to an organisation");
  }

  await ctx.db.insert("organizationMembers", {
    organizationId: invitation.organizationId,
    userId: user._id,
    joinedAt: Date.now(),
  });

  await ctx.db.patch(invitation._id, { status: "accepted" });

  await ctx.db
    .query("organizationInvitations")
    .withIndex("by_email_and_status", (q) =>
      q.eq("email", invitation.email).eq("status", "pending"),
    )
    .collect()
    .then((pendingInvites) =>
      Promise.all(
        pendingInvites
          .filter((item) => item._id !== invitation._id)
          .map((item) => ctx.db.patch(item._id, { status: "cancelled" })),
      ),
    );
}

async function findMemberByEmail(ctx: MutationCtx, email: string) {
  const normalizedEmail = normalizeEmail(email);
  const members = await ctx.db.query("organizationMembers").collect();

  for (const member of members) {
    const authUser = await authComponent.getAnyUserById(ctx, member.userId);
    if (authUser && normalizeEmail(authUser.email) === normalizedEmail) {
      return member;
    }
  }

  return null;
}

export const createOrganization = mutation({
  args: {
    name: v.string(),
  },
  returns: v.id("organizations"),
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    const trimmedName = args.name.trim();

    if (!trimmedName) {
      throw new ConvexError("Organisation name is required");
    }

    const existingMembership = await getMembershipForUser(ctx, user._id);
    if (existingMembership) {
      throw new ConvexError("You already belong to an organisation");
    }

    const slug = await generateUniqueSlug(ctx, trimmedName);
    const organizationId = await ctx.db.insert("organizations", {
      name: trimmedName,
      slug,
      createdByUserId: user._id,
      createdAt: Date.now(),
    });

    await ctx.db.insert("organizationMembers", {
      organizationId,
      userId: user._id,
      joinedAt: Date.now(),
    });

    return organizationId;
  },
});

export const inviteMember = mutation({
  args: {
    email: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    const membership = await requireMembership(ctx, user._id);
    const normalizedEmail = normalizeEmail(args.email);

    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      throw new ConvexError("Enter a valid email address");
    }

    if (normalizeEmail(user.email) === normalizedEmail) {
      throw new ConvexError("You cannot invite yourself");
    }

    const organization = await ctx.db.get(membership.organizationId);
    if (!organization) {
      throw new ConvexError("Organisation not found");
    }

    const existingMember = await findMemberByEmail(ctx, normalizedEmail);
    if (existingMember) {
      throw new ConvexError("This person is already a member");
    }

    const now = Date.now();
    const pendingInvites = await ctx.db
      .query("organizationInvitations")
      .withIndex("by_organizationId_and_status", (q) =>
        q.eq("organizationId", organization._id).eq("status", "pending"),
      )
      .collect();

    for (const invite of pendingInvites) {
      if (invite.email === normalizedEmail) {
        await ctx.db.patch(invite._id, { status: "cancelled" });
      }
    }

    const token = generateInvitationToken();
    await ctx.db.insert("organizationInvitations", {
      organizationId: organization._id,
      email: normalizedEmail,
      invitedByUserId: user._id,
      token,
      status: "pending",
      expiresAt: now + INVITATION_TTL_MS,
      createdAt: now,
    });

    const inviterSettings = await ctx.db
      .query("userSettings")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .unique();

    const locale = inviterSettings?.locale ?? "nl";
    const acceptUrl = `${siteUrl}/accept-invitation/${token}`;

    await ctx.scheduler.runAfter(
      0,
      internal.emails.actions.sendOrganizationInvitationEmail,
      {
        to: normalizedEmail,
        inviterName: getUserDisplayName(user),
        organizationName: organization.name,
        acceptUrl,
        locale,
      },
    );

    return null;
  },
});

export const acceptInvitation = mutation({
  args: {
    token: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    await acceptInvitationForUser(ctx, user, args.token);
    return null;
  },
});

export const acceptPendingInvitationForCurrentUser = mutation({
  args: {},
  returns: v.boolean(),
  handler: async (ctx) => {
    const user = await authComponent.getAuthUser(ctx);
    const normalizedEmail = normalizeEmail(user.email);

    const invitation = await ctx.db
      .query("organizationInvitations")
      .withIndex("by_email_and_status", (q) =>
        q.eq("email", normalizedEmail).eq("status", "pending"),
      )
      .first();

    if (!invitation || invitation.expiresAt <= Date.now()) {
      return false;
    }

    const existingMembership = await getMembershipForUser(ctx, user._id);
    if (existingMembership) {
      return false;
    }

    await acceptInvitationForUser(ctx, user, invitation.token);
    return true;
  },
});

export const cancelInvitation = mutation({
  args: {
    invitationId: v.id("organizationInvitations"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    const membership = await requireMembership(ctx, user._id);

    const invitation = await ctx.db.get(args.invitationId);
    if (!invitation || invitation.organizationId !== membership.organizationId) {
      throw new ConvexError("Invitation not found");
    }

    if (invitation.status !== "pending") {
      throw new ConvexError("Invitation is no longer pending");
    }

    await ctx.db.patch(invitation._id, { status: "cancelled" });
    return null;
  },
});

export const deleteMember = mutation({
  args: {
    memberId: v.id("organizationMembers"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    const membership = await requireMembership(ctx, user._id);

    const targetMember = await ctx.db.get(args.memberId);
    if (
      !targetMember ||
      targetMember.organizationId !== membership.organizationId
    ) {
      throw new ConvexError("Member not found");
    }

    const memberCount = await getOrganizationMemberCount(
      ctx,
      membership.organizationId,
    );
    if (memberCount <= 1) {
      throw new ConvexError("Cannot remove the last member of an organisation");
    }

    await ctx.db.delete(targetMember._id);

    const settings = await ctx.db
      .query("userSettings")
      .withIndex("by_userId", (q) => q.eq("userId", targetMember.userId))
      .unique();
    if (settings) {
      await ctx.db.delete(settings._id);
    }

    const targetAuthUser = await authComponent.getAnyUserById(
      ctx,
      targetMember.userId,
    );
    if (targetAuthUser) {
      const pendingLocale = await ctx.db
        .query("pendingEmailLocales")
        .withIndex("by_email", (q) =>
          q.eq("email", normalizeEmail(targetAuthUser.email)),
        )
        .unique();
      if (pendingLocale) {
        await ctx.db.delete(pendingLocale._id);
      }
    }

    await ctx.scheduler.runAfter(0, internal.auth.deleteUserAccount.deleteUserAccount, {
      userId: targetMember.userId,
    });

    return null;
  },
});
