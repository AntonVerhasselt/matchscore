"use client";

import Link from "next/link";
import { Lock } from "lucide-react";
import { useTranslations } from "next-intl";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { SubscriptionStatus } from "@/convex/billing/types";
import type { FeatureBlockReason } from "@/lib/goal-highlights/errors";
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
  const descriptionKey = getDescriptionKey(blockReason, subscriptionStatus);

  if (compact) {
    return (
      <p className={cn("text-sm text-muted-foreground", className)}>
        {t(descriptionKey)}{" "}
        <Link
          href="/app/settings"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          {t("viewBilling")}
        </Link>
      </p>
    );
  }

  return (
    <Alert className={cn("border-dashed", className)}>
      <Lock className="size-4" aria-hidden />
      <AlertTitle>{t("goalHighlightsTitle")}</AlertTitle>
      <AlertDescription className="space-y-3">
        <p>{t(descriptionKey)}</p>
        <Button asChild variant="outline" size="sm">
          <Link href="/app/settings">{t("viewBilling")}</Link>
        </Button>
      </AlertDescription>
    </Alert>
  );
}
