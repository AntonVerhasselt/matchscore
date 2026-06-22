"use node";

import { ConvexError, v } from "convex/values";
import Stripe from "stripe";
import { components, internal } from "../_generated/api";
import { action, type ActionCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import {
  getCheckoutTaxRateIds,
  hasActivePaidSubscription,
} from "./helpers";
import {
  tierToPriceId,
  type PaidPlanTier,
  type SubscriptionPlanTier,
} from "./stripeCatalog";
import { subscriptionPlanTierValidator } from "./validators";

const checkoutSessionResultValidator = v.object({
  url: v.union(v.string(), v.null()),
});

function getSiteUrl(): string {
  const siteUrl = process.env.SITE_URL?.trim();
  if (!siteUrl) {
    throw new ConvexError("SITE_URL is not configured");
  }
  return siteUrl.replace(/\/$/, "");
}

function getStripeSecretKey(): string {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) {
    throw new ConvexError("STRIPE_SECRET_KEY is not configured");
  }
  return key;
}

function createStripeClient(): Stripe {
  return new Stripe(getStripeSecretKey());
}

async function getOrCreateOrgStripeCustomer(
  ctx: ActionCtx,
  args: {
    organizationId: Id<"organizations">;
    organizationName: string;
    existingCustomerId: string | null;
    userEmail: string;
    userName: string | null;
  },
): Promise<string> {
  if (args.existingCustomerId) {
    return args.existingCustomerId;
  }

  const stripeSubscription = await ctx.runQuery(
    components.stripe.public.getSubscriptionByOrgId,
    { orgId: args.organizationId },
  );
  if (stripeSubscription?.stripeCustomerId) {
    await ctx.runMutation(internal.billing.internalMutations.setStripeCustomerId, {
      organizationId: args.organizationId,
      stripeCustomerId: stripeSubscription.stripeCustomerId,
    });
    return stripeSubscription.stripeCustomerId;
  }

  const stripe = createStripeClient();
  const customer = await stripe.customers.create(
    {
      email: args.userEmail,
      name: args.userName ?? args.organizationName,
      metadata: {
        orgId: args.organizationId,
      },
    },
    { idempotencyKey: `org_customer_${args.organizationId}` },
  );

  await ctx.runMutation(components.stripe.public.createOrUpdateCustomer, {
    stripeCustomerId: customer.id,
    email: args.userEmail,
    name: args.userName ?? args.organizationName,
    metadata: { orgId: args.organizationId },
  });

  await ctx.runMutation(internal.billing.internalMutations.setStripeCustomerId, {
    organizationId: args.organizationId,
    stripeCustomerId: customer.id,
  });

  return customer.id;
}

async function createOrgCheckoutSession(
  ctx: ActionCtx,
  args: {
    tier: PaidPlanTier;
    billingCountry: string;
    mode: "subscription" | "payment";
  },
): Promise<{ url: string | null }> {
  const checkoutContext = await ctx.runQuery(
    internal.billing.internalQueries.getCheckoutContext,
    args.mode === "subscription"
      ? { subscriptionTier: args.tier as SubscriptionPlanTier }
      : {},
  );

  if (
    args.tier === "lifetime" &&
    hasActivePaidSubscription({
      plan: checkoutContext.plan,
      subscriptionStatus: checkoutContext.subscriptionStatus,
    })
  ) {
    throw new ConvexError(
      "Lifetime checkout is not available while an active subscription exists",
    );
  }

  const customerId = await getOrCreateOrgStripeCustomer(ctx, {
    organizationId: checkoutContext.organizationId,
    organizationName: checkoutContext.organizationName,
    existingCustomerId: checkoutContext.stripeCustomerId,
    userEmail: checkoutContext.userEmail,
    userName: checkoutContext.userName,
  });

  const siteUrl = getSiteUrl();
  const stripe = createStripeClient();
  const priceId = tierToPriceId(args.tier);
  const taxRateIds = getCheckoutTaxRateIds(args.billingCountry);
  const orgMetadata = {
    orgId: checkoutContext.organizationId,
    tier: args.tier,
  };

  const session = await stripe.checkout.sessions.create({
    mode: args.mode,
    customer: customerId,
    line_items: [
      {
        price: priceId,
        quantity: 1,
        ...(taxRateIds.length > 0 ? { tax_rates: taxRateIds } : {}),
      },
    ],
    success_url: `${siteUrl}/app?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl}/onboarding?checkout=canceled`,
    metadata: orgMetadata,
    ...(args.mode === "subscription"
      ? {
          subscription_data: {
            metadata: { orgId: checkoutContext.organizationId },
          },
        }
      : {
          payment_intent_data: {
            metadata: orgMetadata,
          },
        }),
  });

  return { url: session.url };
}

export const createOrgSubscriptionCheckout = action({
  args: {
    tier: subscriptionPlanTierValidator,
    billingCountry: v.string(),
  },
  returns: checkoutSessionResultValidator,
  handler: async (ctx, args) => {
    if (!args.billingCountry.trim()) {
      throw new ConvexError("Billing country is required");
    }

    return await createOrgCheckoutSession(ctx, {
      tier: args.tier,
      billingCountry: args.billingCountry,
      mode: "subscription",
    });
  },
});

export const createOrgLifetimeCheckout = action({
  args: {
    billingCountry: v.string(),
  },
  returns: checkoutSessionResultValidator,
  handler: async (ctx, args) => {
    if (!args.billingCountry.trim()) {
      throw new ConvexError("Billing country is required");
    }

    return await createOrgCheckoutSession(ctx, {
      tier: "lifetime",
      billingCountry: args.billingCountry,
      mode: "payment",
    });
  },
});
