"use client";

import { AppPageHeader } from "@/components/app-page";
import { useTranslations } from "next-intl";

export default function CalendarPage() {
  const t = useTranslations("app.calendar");

  return <AppPageHeader title={t("title")} description={t("description")} />;
}
