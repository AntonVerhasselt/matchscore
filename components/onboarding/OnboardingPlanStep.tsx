"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/convex/_generated/api";
import { showErrorToast } from "@/lib/user-feedback";
import { useAction, useMutation, useQuery } from "convex/react";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

const BILLING_COUNTRIES = ["BE", "NL", "FR", "DE", "OTHER"] as const;

type BillingCountry = (typeof BILLING_COUNTRIES)[number];

type PaidPlanTier = "minimum" | "pro" | "elite" | "lifetime";

function formatEuro(amount: number): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function OnboardingPlanStep() {
  const t = useTranslations("onboarding.planStep");
  const router = useRouter();
  const planOptions = useQuery(api.billing.queries.getOnboardingPlanOptions);
  const skipBillingOnboarding = useMutation(
    api.billing.mutations.skipBillingOnboarding,
  );
  const createSubscriptionCheckout = useAction(
    api.billing.actions.createOrgSubscriptionCheckout,
  );
  const createLifetimeCheckout = useAction(
    api.billing.actions.createOrgLifetimeCheckout,
  );

  const [billingCountry, setBillingCountry] = useState<BillingCountry>("BE");
  const [loadingTier, setLoadingTier] = useState<PaidPlanTier | null>(null);
  const [isSkipping, setIsSkipping] = useState(false);

  const isLoading = planOptions === undefined;

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

  const handleSkip = async () => {
    setIsSkipping(true);

    try {
      await skipBillingOnboarding({});
      router.push("/app");
    } catch {
      showErrorToast(t("skipFailed"));
    } finally {
      setIsSkipping(false);
    }
  };

  return (
    <Card className="w-full max-w-3xl">
      <CardHeader className="text-center">
        <CardTitle className="font-heading text-3xl uppercase tracking-tight">
          {t("title")}
        </CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
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

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {t("loading")}
          </div>
        ) : (
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
        )}

        <div className="border-t pt-4 text-center">
          <Button
            type="button"
            variant="ghost"
            className="text-muted-foreground hover:text-foreground"
            disabled={loadingTier !== null || isSkipping}
            onClick={() => void handleSkip()}
          >
            {isSkipping ? t("pleaseWait") : t("skip")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
