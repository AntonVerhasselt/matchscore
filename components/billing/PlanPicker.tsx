"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/convex/_generated/api";
import type { PlanTier } from "@/convex/billing/types";
import { showErrorToast } from "@/lib/user-feedback";
import { useAction } from "convex/react";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

const BILLING_COUNTRIES = ["BE", "NL", "FR", "DE", "OTHER"] as const;

type BillingCountry = (typeof BILLING_COUNTRIES)[number];

type PaidPlanTier = Exclude<PlanTier, "none">;

export type PlanOption = {
  tier: PaidPlanTier;
  monthlyPriceEuros: number | null;
  yearlyPriceEuros: number | null;
  oneTimePriceEuros: number | null;
};

type PlanPickerProps = {
  planOptions: PlanOption[];
  onSkip?: () => void;
  isSkipping?: boolean;
};

function formatEuro(amount: number): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function PlanPicker({
  planOptions,
  onSkip,
  isSkipping = false,
}: PlanPickerProps) {
  const t = useTranslations("onboarding.planStep");

  const createSubscriptionCheckout = useAction(
    api.billing.actions.createOrgSubscriptionCheckout,
  );
  const createLifetimeCheckout = useAction(
    api.billing.actions.createOrgLifetimeCheckout,
  );

  const [billingCountry, setBillingCountry] = useState<BillingCountry>("BE");
  const [loadingTier, setLoadingTier] = useState<PaidPlanTier | null>(null);

  const handleCheckout = async (tier: PaidPlanTier) => {
    setLoadingTier(tier);

    try {
      const result =
        tier === "lifetime"
          ? await createLifetimeCheckout({ billingCountry })
          : await createSubscriptionCheckout({ tier, billingCountry });

      if (!result.url) {
        showErrorToast(t("checkoutFailed"));
        return;
      }

      window.location.assign(result.url);
    } catch {
      showErrorToast(t("checkoutFailed"));
    } finally {
      setLoadingTier(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="billingCountry">{t("countryLabel")}</Label>
        <Select
          value={billingCountry}
          onValueChange={(value) => setBillingCountry(value as BillingCountry)}
        >
          <SelectTrigger id="billingCountry" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BILLING_COUNTRIES.map((country) => (
              <SelectItem key={country} value={country}>
                {t(`countries.${country}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">{t("vatNote")}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {planOptions.map((plan) => {
          const isLifetime = plan.oneTimePriceEuros != null;
          const isBusy = loadingTier === plan.tier;

          return (
            <div
              key={plan.tier}
              className="flex flex-col justify-between border bg-muted/20 p-4"
            >
              <div className="space-y-2">
                <p className="font-heading text-lg font-bold uppercase tracking-tight">
                  {t(`plans.${plan.tier}.title`)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t(`plans.${plan.tier}.description`)}
                </p>
                <div>
                  {isLifetime ? (
                    <p className="font-heading text-2xl font-bold">
                      {formatEuro(plan.oneTimePriceEuros!)}
                      <span className="ml-1 text-sm font-normal text-muted-foreground">
                        {t("oneTime")}
                      </span>
                    </p>
                  ) : (
                    <>
                      <p className="font-heading text-2xl font-bold">
                        {formatEuro(plan.monthlyPriceEuros!)}
                        <span className="ml-1 text-sm font-normal text-muted-foreground">
                          {t("perMonth")}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t("yearlyPrice", {
                          price: formatEuro(plan.yearlyPriceEuros!),
                        })}
                      </p>
                    </>
                  )}
                </div>
              </div>

              <Button
                type="button"
                className="mt-4 w-full font-heading uppercase tracking-wide"
                disabled={loadingTier !== null || isSkipping}
                onClick={() => void handleCheckout(plan.tier)}
              >
                {isBusy ? t("pleaseWait") : t("choosePlan")}
              </Button>
            </div>
          );
        })}
      </div>

      {onSkip ? (
        <div className="border-t pt-4 text-center">
          <Button
            type="button"
            variant="ghost"
            className="text-muted-foreground hover:text-foreground"
            disabled={loadingTier !== null || isSkipping}
            onClick={onSkip}
          >
            {isSkipping ? t("pleaseWait") : t("skip")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function PlanPickerLoading() {
  const t = useTranslations("onboarding.planStep");

  return (
    <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" />
      {t("loading")}
    </div>
  );
}
