"use client";

import { AppPageHeader } from "@/components/app-page";
import { AutomationTypeCard } from "@/components/automations/automation-type-card";
import { SubscriptionRequiredDialog } from "@/components/billing/SubscriptionRequiredDialog";
import { api } from "@/convex/_generated/api";
import {
  AUTOMATION_TYPE_ORDER,
  toBackendAutomationType,
} from "@/lib/automations/types";
import { useOrgFeatures } from "@/lib/billing/use-org-features";
import { useMutation, useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";

export default function AutomationsPage() {
  const t = useTranslations("app.automations");
  const {
    context: billingContext,
    automationsPostBlockReason,
  } = useOrgFeatures();
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);
  const automations = useQuery(api.automations.queries.listAutomations);
  const ensureAutomations = useMutation(
    api.automations.mutations.ensureCurrentOrganizationAutomations,
  );
  const hasEnsuredAutomationsRef = useRef(false);

  useEffect(() => {
    if (automations && !hasEnsuredAutomationsRef.current) {
      void ensureAutomations({})
        .then(() => {
          hasEnsuredAutomationsRef.current = true;
        })
        .catch((error) => {
          console.error("Failed to ensure organization automations:", error);
        });
    }
  }, [automations, ensureAutomations]);

  const automationsByType = useMemo(
    () =>
      new Map(
        (automations ?? []).map((automation) => [
          automation.automationType,
          automation,
        ]),
      ),
    [automations],
  );

  return (
    <>
      {automationsPostBlockReason && billingContext ? (
        <SubscriptionRequiredDialog
          open={upgradeDialogOpen}
          onOpenChange={setUpgradeDialogOpen}
          blockReason={automationsPostBlockReason}
          subscriptionStatus={billingContext.subscriptionStatus}
        />
      ) : null}

      <AppPageHeader title={t("title")} description={t("description")} />

      <div className="space-y-3">
        {automations === undefined
          ? AUTOMATION_TYPE_ORDER.map((automationType) => (
              <Skeleton key={automationType} className="h-52 w-full" />
            ))
          : AUTOMATION_TYPE_ORDER.map((automationType) => (
              <AutomationTypeCard
                key={automationType}
                automationType={automationType}
                automation={automationsByType.get(
                  toBackendAutomationType(automationType),
                )}
                onEnableBlocked={() => setUpgradeDialogOpen(true)}
              />
            ))}
      </div>
    </>
  );
}
