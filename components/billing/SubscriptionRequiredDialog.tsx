"use client";

import { useQuery } from "convex/react";
import { useTranslations } from "next-intl";

import {
  PlanPicker,
  PlanPickerLoading,
} from "@/components/billing/PlanPicker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api } from "@/convex/_generated/api";
import type { SubscriptionStatus } from "@/convex/billing/types";
import type { FeatureBlockReason } from "@/lib/goal-highlights/errors";
import { useBillingPortal } from "@/lib/billing/use-billing-portal";

type SubscriptionRequiredDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  blockReason: FeatureBlockReason;
  subscriptionStatus: SubscriptionStatus;
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

export function SubscriptionRequiredDialog({
  open,
  onOpenChange,
  blockReason,
  subscriptionStatus,
}: SubscriptionRequiredDialogProps) {
  const t = useTranslations("app.billing.automationsUpgrade");
  const planOptions = useQuery(
    api.billing.queries.getOnboardingPlanOptions,
    open && blockReason === "upgrade_required" ? {} : "skip",
  );
  const { openBillingPortal, isOpeningPortal, isBillingReady } =
    useBillingPortal();
  const descriptionKey = getDescriptionKey(blockReason, subscriptionStatus);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90vh,48rem)] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t(descriptionKey)}</DialogDescription>
        </DialogHeader>

        {blockReason === "upgrade_required" ? (
          planOptions === undefined ? (
            <PlanPickerLoading />
          ) : (
            <PlanPicker planOptions={planOptions} />
          )
        ) : (
          <div className="flex justify-end">
            <Button
              type="button"
              disabled={!isBillingReady || isOpeningPortal}
              onClick={() => void openBillingPortal()}
            >
              {isOpeningPortal ? t("openingPortal") : t("manageSubscription")}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
