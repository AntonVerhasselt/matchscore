"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import type { SubscriptionStatus } from "@/convex/billing/types";
import type { FeatureBlockReason } from "@/lib/goal-highlights/errors";
import { useBillingPortal } from "@/lib/billing/use-billing-portal";
import { useOrgFeatures } from "@/lib/billing/use-org-features";

function getBannerMessageKey(
  blockReason: FeatureBlockReason,
  subscriptionStatus: SubscriptionStatus,
): string {
  if (blockReason === "upgrade_required") {
    return "upgradeRequired";
  }

  if (subscriptionStatus === "past_due") {
    return "subscriptionPastDue";
  }

  return "subscriptionInactive";
}

export function SubscriptionBanner() {
  const t = useTranslations("app.billing.subscriptionBanner");
  const router = useRouter();
  const {
    context,
    isLoading,
    hasAutomationsPost,
    automationsPostBlockReason,
  } = useOrgFeatures();
  const { openBillingPortal, isOpeningPortal, isBillingReady } =
    useBillingPortal();

  if (isLoading || hasAutomationsPost || !automationsPostBlockReason || !context) {
    return null;
  }

  const messageKey = getBannerMessageKey(
    automationsPostBlockReason,
    context.subscriptionStatus,
  );
  const isUpgradeRequired = automationsPostBlockReason === "upgrade_required";

  const handleAction = () => {
    if (isUpgradeRequired) {
      router.push("/onboarding");
      return;
    }

    void openBillingPortal();
  };

  return (
    <div
      role="status"
      className="flex shrink-0 flex-col gap-3 border-b border-amber-200/80 bg-amber-50 px-5 py-3 sm:flex-row sm:items-center sm:justify-between md:px-10"
    >
      <p className="text-sm text-amber-950">{t(messageKey)}</p>
      <Button
        type="button"
        size="sm"
        className="shrink-0 bg-amber-900 text-amber-50 hover:bg-amber-900/90"
        disabled={!isUpgradeRequired && (!isBillingReady || isOpeningPortal)}
        onClick={handleAction}
      >
        {isUpgradeRequired
          ? t("choosePlan")
          : isOpeningPortal
            ? t("openingPortal")
            : t("manageSubscription")}
      </Button>
    </div>
  );
}
