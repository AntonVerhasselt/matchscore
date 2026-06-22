"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

function formatTimestamp(timestamp: number | null): string {
  if (timestamp === null) {
    return "—";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

export function BillingSettings() {
  const t = useTranslations("settings.billing");
  const billing = useQuery(api.billing.queries.getOrgBillingState);
  const features = useQuery(api.billing.queries.getOrgFeatures);

  const isLoading = billing === undefined || features === undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {t("loading")}
          </div>
        ) : billing === null ? (
          <p className="text-sm text-muted-foreground">{t("unavailable")}</p>
        ) : (
          <>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">{t("plan")}</dt>
                <dd className="font-medium capitalize">{billing.plan}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t("subscriptionStatus")}</dt>
                <dd className="font-medium capitalize">
                  {billing.subscriptionStatus.replaceAll("_", " ")}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t("stripeCatalogMode")}</dt>
                <dd className="font-medium uppercase">{billing.stripeCatalogMode}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t("billingSyncedAt")}</dt>
                <dd className="font-medium">
                  {formatTimestamp(billing.billingSyncedAt)}
                </dd>
              </div>
            </dl>

            {features ? (
              <div className="rounded-md border border-border p-3">
                <p className="mb-2 text-sm font-medium">{t("featuresTitle")}</p>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>
                    {t("featureAutomationsEdit")}:{" "}
                    {features.automationsEdit ? t("enabled") : t("disabled")}
                  </li>
                  <li>
                    {t("featureAutomationsPost")}:{" "}
                    {features.automationsPost ? t("enabled") : t("disabled")}
                  </li>
                  <li>
                    {t("featureGoalHighlights")}:{" "}
                    {features.goalHighlightsGenerate
                      ? t("enabled")
                      : t("disabled")}
                  </li>
                  <li>
                    {t("featureWatermark")}:{" "}
                    {features.automationsWatermark
                      ? t("enabled")
                      : t("disabled")}
                  </li>
                </ul>
              </div>
            ) : null}

            <div className="rounded-md border border-dashed border-border bg-muted/30 p-3 font-mono text-xs text-muted-foreground">
              <p className="mb-2 font-sans text-sm font-medium text-foreground">
                {t("debugTitle")}
              </p>
              <p>
                {t("stripeCustomerId")}: {billing.stripeCustomerId ?? "—"}
              </p>
              <p>
                {t("stripeSubscriptionId")}:{" "}
                {billing.stripeSubscription?.stripeSubscriptionId ?? "—"}
              </p>
              <p>
                {t("stripePriceId")}:{" "}
                {billing.stripeSubscription?.priceId ?? "—"}
              </p>
              <p>
                {t("currentPeriodEnd")}:{" "}
                {billing.stripeSubscription
                  ? formatTimestamp(billing.stripeSubscription.currentPeriodEnd)
                  : "—"}
              </p>
            </div>

            <Button type="button" disabled>
              {t("subscribeComingSoon")}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
