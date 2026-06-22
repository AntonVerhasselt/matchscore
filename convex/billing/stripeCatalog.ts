export type PaidPlanTier = "minimum" | "pro" | "elite" | "lifetime";

export type SubscriptionPlanTier = Exclude<PaidPlanTier, "lifetime">;

export const planDisplayPricing = {
  minimum: { monthlyEuros: 2, yearlyEuros: 24 },
  pro: { monthlyEuros: 9, yearlyEuros: 108 },
  elite: { monthlyEuros: 12, yearlyEuros: 144 },
  lifetime: { oneTimeEuros: 250 },
} as const satisfies Record<
  PaidPlanTier,
  | { monthlyEuros: number; yearlyEuros: number }
  | { oneTimeEuros: number }
>;

type StripeCatalogEntry = {
  prices: Record<PaidPlanTier, string>;
  taxRates: {
    beVat: string;
  };
};

export const stripeCatalog = {
  test: {
    prices: {
      minimum: "price_1Tl3QHLlL7dLpqB3FJmFBOln",
      pro: "price_1Tl3QlLlL7dLpqB3Hvo9nhhk",
      elite: "price_1Tl3RKLlL7dLpqB3RPwVZotu",
      lifetime: "price_1Tl3RjLlL7dLpqB3J2Yk4WCk",
    },
    taxRates: {
      beVat: "txr_1Tl3IZLlL7dLpqB3NsJp7EcD",
    },
  },
  live: {
    prices: {
      minimum: "price_1TjeEbLQXQ6hQ5Le6Kg8XISW",
      pro: "price_1TjeHdLQXQ6hQ5LeisqGSN1C",
      elite: "price_1Tl2mdLQXQ6hQ5LeHlgJ1fAY",
      lifetime: "price_1TjeJiLQXQ6hQ5LeS9n2Q8qD",
    },
    taxRates: {
      beVat: "",
    },
  },
} satisfies Record<"test" | "live", StripeCatalogEntry>;

export type StripeCatalogMode = keyof typeof stripeCatalog;

export function getStripeCatalogMode(): StripeCatalogMode {
  const key = process.env.STRIPE_SECRET_KEY ?? "";
  return key.startsWith("sk_live_") ? "live" : "test";
}

export function getStripeCatalog(): StripeCatalogEntry {
  return stripeCatalog[getStripeCatalogMode()];
}

export function tierToPriceId(tier: PaidPlanTier): string {
  return getStripeCatalog().prices[tier];
}

export function priceIdToTier(priceId: string): PaidPlanTier | null {
  const { prices } = getStripeCatalog();
  for (const tier of Object.keys(prices) as PaidPlanTier[]) {
    if (prices[tier] === priceId) {
      return tier;
    }
  }
  return null;
}

export function getBelgianVatTaxRateId(): string | null {
  const taxRateId = getStripeCatalog().taxRates.beVat.trim();
  return taxRateId.length > 0 ? taxRateId : null;
}
