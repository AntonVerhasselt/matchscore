"use client";

import { AppPageHeader } from "@/components/app-page";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useTranslations } from "next-intl";

const PLANNED_FEATURE_KEYS = [
  "overview",
  "connect",
  "disconnect",
  "accountDetails",
  "automationUsage",
  "reauth",
] as const;

export default function SocialsPage() {
  const t = useTranslations("app.socials");

  return (
    <>
      <AppPageHeader title={t("title")} description={t("description")} />

      <Card>
        <CardHeader>
          <CardTitle>{t("planned.title")}</CardTitle>
          <CardDescription>{t("planned.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
            {PLANNED_FEATURE_KEYS.map((key) => (
              <li key={key}>{t(`planned.features.${key}`)}</li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </>
  );
}
