"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PlanPicker, PlanPickerLoading } from "@/components/billing/PlanPicker";
import { api } from "@/convex/_generated/api";
import { showErrorToast } from "@/lib/user-feedback";
import { useMutation, useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function OnboardingPlanStep() {
  const t = useTranslations("onboarding.planStep");
  const router = useRouter();
  const planOptions = useQuery(api.billing.queries.getOnboardingPlanOptions);
  const skipBillingOnboarding = useMutation(
    api.billing.mutations.skipBillingOnboarding,
  );
  const [isSkipping, setIsSkipping] = useState(false);

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

      <CardContent>
        {planOptions === undefined ? (
          <PlanPickerLoading />
        ) : (
          <PlanPicker
            planOptions={planOptions}
            onSkip={() => void handleSkip()}
            isSkipping={isSkipping}
          />
        )}
      </CardContent>
    </Card>
  );
}
