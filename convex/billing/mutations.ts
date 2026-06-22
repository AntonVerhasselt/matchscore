import { ConvexError, v } from "convex/values";
import { mutation } from "../_generated/server";
import { requireCurrentMembership } from "../automations/helpers";

export const skipBillingOnboarding = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const { membership } = await requireCurrentMembership(ctx);
    const organization = await ctx.db.get(membership.organizationId);

    if (!organization) {
      throw new ConvexError("Organization not found");
    }

    if (organization.billingOnboardingCompletedAt != null) {
      return null;
    }

    await ctx.db.patch(membership.organizationId, {
      billingOnboardingCompletedAt: Date.now(),
    });

    return null;
  },
});
