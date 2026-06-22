import { getTranslations } from "next-intl/server";

import { PricingAnchorSplitLayout } from "./PricingAnchorSplitLayout";
import type { PricingPlans } from "./types";

async function getPricingPlans(): Promise<PricingPlans> {
  const t = await getTranslations("landing");

  return {
    cta: t("pricing.cta"),
    minimum: {
      title: t("pricing.minimum.title"),
      description: t("pricing.minimum.description"),
      price: t("pricing.minimum.price"),
      priceSuffix: t("pricing.perMonth"),
      priceNote: t("pricing.minimum.billingNote"),
      features: t.raw("pricing.minimum.features") as string[],
      compactFeatures: t.raw("pricing.minimum.compactFeatures") as string[],
    },
    pro: {
      title: t("pricing.pro.title"),
      description: t("pricing.pro.description"),
      price: t("pricing.pro.price"),
      priceSuffix: t("pricing.perMonth"),
      priceNote: t("pricing.pro.billingNote"),
      features: t.raw("pricing.pro.features") as string[],
      compactFeatures: t.raw("pricing.pro.compactFeatures") as string[],
    },
    elite: {
      title: t("pricing.elite.title"),
      description: t("pricing.elite.description"),
      price: t("pricing.elite.price"),
      priceSuffix: t("pricing.perMonth"),
      priceNote: t("pricing.elite.billingNote"),
      features: t.raw("pricing.elite.features") as string[],
      compactFeatures: t.raw("pricing.elite.compactFeatures") as string[],
    },
    lifetime: {
      title: t("pricing.lifetime.title"),
      description: t("pricing.lifetime.description"),
      headline: t("pricing.lifetime.headline"),
      price: t("pricing.lifetime.price"),
      priceSuffix: t("pricing.oneTime"),
      priceNote: t("pricing.lifetime.note"),
      features: t.raw("pricing.lifetime.features") as string[],
    },
  };
}

export async function PricingSection() {
  const t = await getTranslations("landing");
  const plans = await getPricingPlans();

  return (
    <section
      id="pricing"
      className="scroll-mt-16 border-t border-border bg-muted/40 px-4 py-12 dark:bg-card/30 sm:scroll-mt-20 sm:px-8 sm:py-20 lg:px-10 lg:py-24"
    >
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-xl tracking-tight text-balance uppercase sm:text-3xl lg:text-4xl">
            {t("pricing.title")}
          </h2>
          <p className="mt-4 text-[0.9375rem] text-muted-foreground sm:text-base">
            {t("pricing.description")}
          </p>
          <p className="mt-2 text-xs text-muted-foreground sm:text-sm">
            {t("pricing.vatNote")}
          </p>
        </div>
        <div className="mt-8 sm:mt-14">
          <PricingAnchorSplitLayout plans={plans} />
        </div>
      </div>
    </section>
  );
}
