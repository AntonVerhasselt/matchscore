"use client";

import {
  Card,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { useTranslations } from "next-intl";

export default function AutomationsPage() {
  const t = useTranslations("app.automations");

  return (
    <>
      <h1 className="mb-8 text-3xl tracking-tight text-foreground">
        {t("title")}
      </h1>
      <Card>
        <CardHeader>
          <CardDescription>{t("description")}</CardDescription>
        </CardHeader>
      </Card>
    </>
  );
}
