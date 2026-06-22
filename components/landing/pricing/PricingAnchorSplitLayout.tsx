import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import Link from "next/link";

import { LifetimeBanner } from "./LifetimeBanner";
import type { PricingPlan, PricingPlans } from "./types";

type PricingAnchorSplitLayoutProps = {
  plans: PricingPlans;
};

function SubscriptionColumn({ plan, cta }: { plan: PricingPlan; cta: string }) {
  const features = plan.compactFeatures ?? plan.features;

  return (
    <div className="flex h-full flex-col border border-border bg-card p-4 sm:p-5">
      <p className="font-heading text-lg uppercase sm:text-xl">{plan.title}</p>
      {plan.description ? (
        <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
          {plan.description}
        </p>
      ) : null}
      <div className="mt-3 grid gap-4 sm:grid-cols-[minmax(0,7.5rem)_1fr] sm:items-center sm:gap-5">
        <div className="shrink-0">
          <div className="flex items-baseline gap-1">
            <span className="font-heading text-2xl tracking-tight sm:text-3xl">
              {plan.price}
            </span>
            <span className="text-xs text-muted-foreground sm:text-sm">
              {plan.priceSuffix}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{plan.priceNote}</p>
        </div>
        <ul className="space-y-1.5">
          {features.map((feature) => (
            <li
              key={feature}
              className="flex items-start gap-1.5 text-xs text-muted-foreground sm:text-sm"
            >
              <Check className="mt-0.5 size-3.5 shrink-0 text-sidebar-primary" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </div>
      <Button variant="outline" className="mt-4 h-11 w-full sm:h-12" asChild>
        <Link href="/sign-in">{cta}</Link>
      </Button>
    </div>
  );
}

export function PricingAnchorSplitLayout({ plans }: PricingAnchorSplitLayoutProps) {
  const { lifetime, minimum, pro, elite, cta } = plans;

  return (
    <div className="space-y-3 sm:space-y-4">
      <LifetimeBanner lifetime={lifetime} cta={cta} />
      <div className="grid gap-3 sm:grid-cols-3 sm:gap-4">
        <SubscriptionColumn plan={minimum} cta={cta} />
        <SubscriptionColumn plan={pro} cta={cta} />
        <SubscriptionColumn plan={elite} cta={cta} />
      </div>
    </div>
  );
}
