"use client";

import { Loader2 } from "lucide-react";
import { Suspense, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { useAction, useQuery } from "convex/react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { api } from "@/convex/_generated/api";
import { formatSubscriptionStatusLabel } from "@/lib/billing/format-subscription-status";
import {
  formatMillisTimestamp,
  formatStripeUnixTimestamp,
} from "@/lib/billing/format-timestamp";
import { useBillingPortal } from "@/lib/billing/use-billing-portal";

function StripeInfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium break-all">{value}</dd>
    </div>
  );
}

function capitalizeWords(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function BillingPortalReturnSync({
  onSyncStateChange,
}: {
  onSyncStateChange: (isSyncing: boolean) => void;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const syncBilling = useAction(
    api.billing.actions.syncCurrentOrgBillingFromStripe,
  );
  const handledRef = useRef(false);

  useEffect(() => {
    if (handledRef.current || searchParams.get("billing") !== "sync") {
      return;
    }

    handledRef.current = true;
    onSyncStateChange(true);

    void (async () => {
      try {
        await syncBilling({});
      } finally {
        onSyncStateChange(false);
        router.replace("/app/settings", { scroll: false });
      }
    })();
  }, [onSyncStateChange, router, searchParams, syncBilling]);

  return null;
}

function BillingSettingsContent() {
  const t = useTranslations("settings.billing");
  const locale = useLocale();
  const { openBillingPortal, isOpeningPortal, isBillingReady } =
    useBillingPortal();
  const billing = useQuery(api.billing.queries.getOrgBillingState);
  const syncBilling = useAction(
    api.billing.actions.syncCurrentOrgBillingFromStripe,
  );
  const [isSyncingFromPortal, setIsSyncingFromPortal] = useState(false);
  const syncedOnMountRef = useRef(false);

  useEffect(() => {
    if (
      syncedOnMountRef.current ||
      billing === undefined ||
      billing === null ||
      !billing.stripeCustomerId ||
      billing.plan === "none" ||
      billing.plan === "lifetime"
    ) {
      return;
    }

    syncedOnMountRef.current = true;
    void syncBilling({});
  }, [billing, syncBilling]);

  const isLoading = billing === undefined || isSyncingFromPortal;

  const subscriptionStatusLabel = billing
    ? formatSubscriptionStatusLabel(
        billing.subscriptionStatus,
        billing.subscriptionCancelAtPeriodEnd,
        {
          active: t("status.active"),
          pastDue: t("status.pastDue"),
          canceled: t("status.canceled"),
          none: t("status.none"),
          canceling: t("status.canceling"),
        },
      )
    : "";

  return (
    <Card>
      <Suspense fallback={null}>
        <BillingPortalReturnSync onSyncStateChange={setIsSyncingFromPortal} />
      </Suspense>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {isSyncingFromPortal ? t("syncing") : t("loading")}
          </div>
        ) : billing === null ? (
          <p className="text-sm text-muted-foreground">{t("unavailable")}</p>
        ) : (
          <>
            <div className="flex items-center gap-3 text-sm">
              <StripeInfoRow
                label={t("plan")}
                value={capitalizeWords(billing.plan)}
              />
              <Button
                type="button"
                size="sm"
                className="shrink-0"
                disabled={!isBillingReady || isOpeningPortal}
                onClick={() => void openBillingPortal()}
              >
                {isOpeningPortal ? t("openingPortal") : t("upgrade")}
              </Button>
            </div>

            <Accordion type="single" collapsible className="rounded-md border">
              <AccordionItem value="stripe-info" className="border-0">
                <AccordionTrigger className="px-3 py-2 text-sm font-medium hover:no-underline">
                  {t("stripeInfoTitle")}
                </AccordionTrigger>
                <AccordionContent className="px-3 pb-3">
                  <dl className="grid gap-3 text-sm sm:grid-cols-2">
                    <StripeInfoRow
                      label={t("subscriptionStatus")}
                      value={subscriptionStatusLabel}
                    />
                    <StripeInfoRow
                      label={t("stripeCustomerId")}
                      value={billing.stripeCustomerId ?? "—"}
                    />
                    <StripeInfoRow
                      label={t("stripeCatalogMode")}
                      value={billing.stripeCatalogMode.toUpperCase()}
                    />
                    <StripeInfoRow
                      label={t("stripeSubscriptionId")}
                      value={
                        billing.stripeSubscription?.stripeSubscriptionId ?? "—"
                      }
                    />
                    <StripeInfoRow
                      label={t("billingSyncedAt")}
                      value={formatMillisTimestamp(
                        billing.billingSyncedAt,
                        locale,
                      )}
                    />
                    <StripeInfoRow
                      label={t("stripePriceId")}
                      value={billing.stripeSubscription?.priceId ?? "—"}
                    />
                    <StripeInfoRow
                      label={t("currentPeriodEnd")}
                      value={
                        billing.stripeSubscription
                          ? formatStripeUnixTimestamp(
                              billing.stripeSubscription.currentPeriodEnd,
                              locale,
                            )
                          : "—"
                      }
                    />
                  </dl>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function BillingSettings() {
  return <BillingSettingsContent />;
}
