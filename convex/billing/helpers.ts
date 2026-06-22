import type { PlanTier, SubscriptionStatus } from "./types";
import type { PaidPlanTier } from "./stripeCatalog";
import { getBelgianVatTaxRateId } from "./stripeCatalog";

export function mapStripeSubscriptionStatus(
  stripeStatus: string,
): SubscriptionStatus {
  switch (stripeStatus) {
    case "active":
    case "trialing":
      return "active";
    case "past_due":
      return "past_due";
    case "canceled":
    case "unpaid":
    case "incomplete_expired":
      return "canceled";
    default:
      return "none";
  }
}

export function hasActivePaidSubscription(org: {
  plan?: PlanTier;
  subscriptionStatus?: SubscriptionStatus;
}): boolean {
  const plan = org.plan ?? "none";
  const status = org.subscriptionStatus ?? "none";

  if (plan === "none" || plan === "lifetime") {
    return false;
  }

  return status === "active";
}

/** Active or past_due subscription — use Customer Portal, not new Checkout. */
export function hasManageableSubscription(org: {
  plan?: PlanTier;
  subscriptionStatus?: SubscriptionStatus;
}): boolean {
  const plan = org.plan ?? "none";
  const status = org.subscriptionStatus ?? "none";

  if (plan === "none" || plan === "lifetime") {
    return false;
  }

  return status === "active" || status === "past_due";
}

export function shouldApplyBelgianVat(billingCountry: string): boolean {
  return billingCountry.trim().toUpperCase() === "BE";
}

export function getCheckoutTaxRateIds(billingCountry: string): string[] {
  if (!shouldApplyBelgianVat(billingCountry)) {
    return [];
  }

  const beVatTaxRateId = getBelgianVatTaxRateId();
  if (!beVatTaxRateId) {
    throw new Error("Belgian VAT tax rate is not configured for this Stripe mode");
  }

  return [beVatTaxRateId];
}

export function isPaidPlanTier(value: string): value is PaidPlanTier {
  return (
    value === "minimum" ||
    value === "pro" ||
    value === "elite" ||
    value === "lifetime"
  );
}
