import type Stripe from "stripe";
import { internal } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import {
  isPaidPlanTier,
  mapStripeSubscriptionStatus,
} from "./helpers";
import { priceIdToTier } from "./stripeCatalog";

type BillingWebhookCtx = Pick<ActionCtx, "runMutation" | "runQuery">;

function readOrgIdFromMetadata(
  metadata: Stripe.Metadata | null | undefined,
): Id<"organizations"> | null {
  const orgId = metadata?.orgId?.trim();
  if (!orgId) {
    return null;
  }
  return orgId as Id<"organizations">;
}

async function resolveOrganizationIdForSubscription(
  ctx: BillingWebhookCtx,
  subscription: Stripe.Subscription,
): Promise<Id<"organizations"> | null> {
  const fromMetadata = readOrgIdFromMetadata(subscription.metadata);
  if (fromMetadata) {
    return fromMetadata;
  }

  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id;
  if (!customerId) {
    return null;
  }

  return await ctx.runQuery(
    internal.billing.internalQueries.getOrganizationIdByStripeCustomerId,
    { stripeCustomerId: customerId },
  );
}

function readStripeCustomerId(
  customer: Stripe.Subscription["customer"],
): string | undefined {
  return typeof customer === "string" ? customer : customer?.id;
}

export async function handleCheckoutSessionCompletedWebhook(
  ctx: BillingWebhookCtx,
  event: Stripe.CheckoutSessionCompletedEvent,
  stripe: Stripe,
): Promise<void> {
  const session = event.data.object;
  const organizationId = readOrgIdFromMetadata(session.metadata);
  if (!organizationId) {
    return;
  }

  const stripeCustomerId =
    typeof session.customer === "string" ? session.customer : undefined;

  if (session.mode === "subscription" && session.subscription) {
    const subscription = await stripe.subscriptions.retrieve(
      session.subscription as string,
    );
    const priceId = subscription.items.data[0]?.price?.id;
    const tier = priceId ? priceIdToTier(priceId) : null;

    if (!tier || tier === "lifetime") {
      console.error("Checkout subscription has unknown price:", priceId);
      return;
    }

    await ctx.runMutation(internal.billing.internalMutations.syncOrganizationBilling, {
      organizationId,
      plan: tier,
      subscriptionStatus: mapStripeSubscriptionStatus(subscription.status),
      subscriptionCancelAtPeriodEnd: subscription.cancel_at_period_end,
      stripeCustomerId,
      markOnboardingComplete: true,
    });
    return;
  }

  if (session.mode === "payment") {
    const tier = session.metadata?.tier?.trim();
    if (tier !== "lifetime" || !isPaidPlanTier(tier)) {
      return;
    }

    await ctx.runMutation(internal.billing.internalMutations.syncOrganizationBilling, {
      organizationId,
      plan: "lifetime",
      subscriptionStatus: "none",
      subscriptionCancelAtPeriodEnd: false,
      stripeCustomerId,
      markOnboardingComplete: true,
    });
  }
}

export async function handleSubscriptionUpdatedWebhook(
  ctx: BillingWebhookCtx,
  event: Stripe.CustomerSubscriptionUpdatedEvent,
): Promise<void> {
  const subscription = event.data.object;
  const organizationId = await resolveOrganizationIdForSubscription(
    ctx,
    subscription,
  );
  if (!organizationId) {
    return;
  }

  const priceId = subscription.items.data[0]?.price?.id;
  const tier = priceId ? priceIdToTier(priceId) : null;

  await ctx.runMutation(internal.billing.internalMutations.syncOrganizationBilling, {
    organizationId,
    ...(tier && tier !== "lifetime" ? { plan: tier } : {}),
    subscriptionStatus: mapStripeSubscriptionStatus(subscription.status),
    subscriptionCancelAtPeriodEnd: subscription.cancel_at_period_end,
    stripeCustomerId: readStripeCustomerId(subscription.customer),
  });
}

export async function handleSubscriptionDeletedWebhook(
  ctx: BillingWebhookCtx,
  event: Stripe.CustomerSubscriptionDeletedEvent,
): Promise<void> {
  const subscription = event.data.object;
  const organizationId = await resolveOrganizationIdForSubscription(
    ctx,
    subscription,
  );
  if (!organizationId) {
    return;
  }

  await ctx.runMutation(internal.billing.internalMutations.syncOrganizationBilling, {
    organizationId,
    subscriptionStatus: "canceled",
    subscriptionCancelAtPeriodEnd: false,
    stripeCustomerId: readStripeCustomerId(subscription.customer),
  });
}

export async function handlePaymentIntentSucceededWebhook(
  ctx: BillingWebhookCtx,
  event: Stripe.PaymentIntentSucceededEvent,
): Promise<void> {
  const paymentIntent = event.data.object;
  const organizationId = readOrgIdFromMetadata(paymentIntent.metadata);
  const tier = paymentIntent.metadata?.tier?.trim();

  if (!organizationId || tier !== "lifetime") {
    return;
  }

  await ctx.runMutation(internal.billing.internalMutations.syncOrganizationBilling, {
    organizationId,
    plan: "lifetime",
    subscriptionStatus: "none",
    subscriptionCancelAtPeriodEnd: false,
    stripeCustomerId:
      typeof paymentIntent.customer === "string"
        ? paymentIntent.customer
        : undefined,
    markOnboardingComplete: true,
  });
}
