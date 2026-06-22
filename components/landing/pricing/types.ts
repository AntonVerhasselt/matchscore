export type PricingPlan = {
  title: string;
  price: string;
  priceSuffix: string;
  priceNote: string;
  features: string[];
  compactFeatures?: string[];
  description?: string;
};

export type PricingPlans = {
  cta: string;
  minimum: PricingPlan;
  pro: PricingPlan;
  elite: PricingPlan;
  lifetime: PricingPlan & {
    headline: string;
  };
};
