"use client";

import { Lock } from "lucide-react";
import { useTranslations } from "next-intl";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { SubscriptionStatus } from "@/convex/billing/types";
import type { FeatureBlockReason } from "@/lib/goal-highlights/errors";
import { useBillingPortal } from "@/lib/billing/use-billing-portal";
import { cn } from "@/lib/utils";

type UpgradePromptProps = {
  blockReason: FeatureBlockReason;
  subscriptionStatus: SubscriptionStatus;
  className?: string;
  compact?: boolean;
};

function getDescriptionKey(
  blockReason: FeatureBlockReason,
  subscriptionStatus: SubscriptionStatus,
): string {
  if (blockReason === "upgrade_required") {
    return "upgradeRequiredDescription";
  }

  if (subscriptionStatus === "past_due") {
    return "subscriptionPastDueDescription";
  }

  return "subscriptionCanceledDescription";
}

export function UpgradePrompt({
  blockReason,
  subscriptionStatus,
  className,
  compact = false,
}: UpgradePromptProps) {
  const t = useTranslations("app.billing.upgrade");
  const { openBillingPortal, isOpeningPortal, isBillingReady } =
    useBillingPortal();
  const descriptionKey = getDescriptionKey(blockReason, subscriptionStatus);

  if (compact) {
    return (
      <p className={cn("text-sm text-muted-foreground", className)}>
        {t(descriptionKey)}{" "}
        <button
          type="button"
          className="font-medium text-foreground underline-offset-4 hover:underline disabled:opacity-50"
          disabled={!isBillingReady || isOpeningPortal}
          onClick={() => void openBillingPortal()}
        >
          {isOpeningPortal ? t("openingPortal") : t("managePlan")}
        </button>
      </p>
    );
  }

  return (
    <Alert className={cn("border-dashed", className)}>
      <Lock className="size-4" aria-hidden />
      <AlertTitle>{t("goalHighlightsTitle")}</AlertTitle>
      <AlertDescription className="space-y-3">
        <p>{t(descriptionKey)}</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!isBillingReady || isOpeningPortal}
          onClick={() => void openBillingPortal()}
        >
          {isOpeningPortal ? t("openingPortal") : t("managePlan")}
        </Button>
      </AlertDescription>
    </Alert>
  );
}
