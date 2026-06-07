import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import Link from "next/link";

import type { PricingPlans } from "./types";

type LifetimeBannerProps = {
  lifetime: PricingPlans["lifetime"];
  cta: string;
};

export function LifetimeBanner({ lifetime, cta }: LifetimeBannerProps) {
  return (
    <div
      className={cn(
        "relative -mx-4 overflow-hidden border-y border-sidebar-border bg-sidebar px-4 py-10 text-sidebar-foreground sm:-mx-8 sm:px-8 sm:py-14 lg:-mx-10 lg:px-10",
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,transparent_0%,var(--sidebar-primary)_120%)] opacity-10"
        aria-hidden
      />
      <div className="relative mx-auto max-w-6xl">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="font-heading text-sm tracking-[0.2em] text-sidebar-primary uppercase sm:text-base">
              {lifetime.headline}
            </p>
            <h3 className="mt-2 font-heading text-5xl leading-[0.9] tracking-tight uppercase sm:text-6xl lg:text-7xl">
              {lifetime.title}
            </h3>
          </div>
          <div className="shrink-0 text-left lg:text-right">
            <div className="flex items-baseline gap-2 lg:justify-end">
              <span className="font-heading text-6xl leading-none tracking-tight sm:text-7xl lg:text-8xl">
                {lifetime.price}
              </span>
              <span className="pb-2 text-lg text-sidebar-foreground/70">
                {lifetime.priceSuffix}
              </span>
            </div>
            <p className="mt-1 text-sm text-sidebar-foreground/60">
              {lifetime.priceNote}
            </p>
            <Button
              size="lg"
              className="mt-6 h-12 w-full bg-sidebar-foreground text-base text-sidebar hover:bg-sidebar-foreground/90 lg:w-auto lg:px-10"
              asChild
            >
              <Link href="/sign-in">{cta}</Link>
            </Button>
          </div>
        </div>
        <ul className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-2 sm:gap-x-6 lg:flex-nowrap lg:gap-x-8">
          {lifetime.features.map((feature) => (
            <li
              key={feature}
              className="flex shrink-0 items-center gap-2 text-xs text-sidebar-foreground/90 sm:text-sm"
            >
              <Check className="size-4 shrink-0 text-sidebar-primary" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
