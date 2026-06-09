import { ConvexError } from "convex/values";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { authComponent } from "../auth/instance";
import { getMembershipForUser } from "../organizations/helpers";
import {
  AUTOMATION_TYPES,
  DEFAULT_POSTING_CHANNEL_STATUSES,
  normalizePostingChannelStatuses,
  type PostingChannelStatuses,
  type AutomationType,
} from "./constants";

const AUTOMATION_DUPLICATE_SCAN_LIMIT = 20;

type LegacyAutomationStatusFields = {
  isEnabled?: boolean;
  isGloballyEnabled?: boolean;
  postingChannels?: Partial<PostingChannelStatuses>;
};

export async function requireCurrentMembership(ctx: QueryCtx | MutationCtx) {
  const user = await authComponent.getAuthUser(ctx);
  const membership = await getMembershipForUser(ctx, user._id);

  if (!membership) {
    throw new ConvexError("You are not a member of an organisation");
  }

  return { user, membership };
}

export async function getOrganizationAutomationRows(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
  automationType: AutomationType,
): Promise<Array<Doc<"organizationAutomations">>> {
  return await ctx.db
    .query("organizationAutomations")
    .withIndex("by_organizationId_and_automationType", (q) =>
      q.eq("organizationId", organizationId).eq("automationType", automationType),
    )
    .take(AUTOMATION_DUPLICATE_SCAN_LIMIT);
}

export async function getPrimaryOrganizationAutomation(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
  automationType: AutomationType,
): Promise<Doc<"organizationAutomations"> | null> {
  const [automation] = await getOrganizationAutomationRows(
    ctx,
    organizationId,
    automationType,
  );
  return automation ?? null;
}

export async function ensureOrganizationAutomations(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  updatedByUserId?: string,
) {
  const now = Date.now();

  for (const automationType of AUTOMATION_TYPES) {
    const rows = await getOrganizationAutomationRows(
      ctx,
      organizationId,
      automationType,
    );
    const existing = rows[0];

    if (!existing) {
      await ctx.db.insert("organizationAutomations", {
        organizationId,
        automationType,
        isGloballyEnabled: true,
        postingChannels: DEFAULT_POSTING_CHANNEL_STATUSES,
        updatedAt: now,
        updatedByUserId,
      });
      continue;
    }

    for (const duplicate of rows.slice(1)) {
      await ctx.db.delete(duplicate._id);
    }

    const legacyStatus = existing as typeof existing & LegacyAutomationStatusFields;
    const nextIsGloballyEnabled =
      legacyStatus.isGloballyEnabled ?? legacyStatus.isEnabled ?? true;
    const nextPostingChannels = normalizePostingChannelStatuses(
      legacyStatus.postingChannels,
    );
    const needsBackfill =
      legacyStatus.isGloballyEnabled === undefined ||
      legacyStatus.postingChannels === undefined ||
      Object.keys(nextPostingChannels).some(
        (channel) =>
          legacyStatus.postingChannels?.[
            channel as keyof PostingChannelStatuses
          ] === undefined,
      );

    if (needsBackfill) {
      await ctx.db.patch(existing._id, {
        isGloballyEnabled: nextIsGloballyEnabled,
        postingChannels: nextPostingChannels,
        updatedAt: now,
        updatedByUserId,
      });
    }
  }
}
