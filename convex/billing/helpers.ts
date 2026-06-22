import type { PaidPlanTier } from "./stripeCatalog";
import { getBelgianVatTaxRateId } from "./stripeCatalog";

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
