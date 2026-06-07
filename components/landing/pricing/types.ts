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
  starter: PricingPlan;
  pro: PricingPlan;
  lifetime: PricingPlan & {
    headline: string;
  };
};
