"use client";

import { AppPageHeader } from "@/components/app-page";
import { CalendarPageContent } from "@/components/calendar/CalendarPageContent";
import { useTranslations } from "next-intl";

export default function CalendarPage() {
  const t = useTranslations("app.calendar");

  return (
    <div className="space-y-6">
      <AppPageHeader title={t("title")} description={t("description")} />
      <CalendarPageContent />
    </div>
  );
}
