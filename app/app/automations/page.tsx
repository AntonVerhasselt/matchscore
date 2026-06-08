"use client";

import { AppPageHeader } from "@/components/app-page";
import { AutomationTypeCard } from "@/components/automations/automation-type-card";
import { AUTOMATION_TYPE_ORDER } from "@/lib/automations/types";
import { useTranslations } from "next-intl";

export default function AutomationsPage() {
  const t = useTranslations("app.automations");

  return (
    <>
      <AppPageHeader title={t("title")} description={t("description")} />

      <div className="space-y-3">
        {AUTOMATION_TYPE_ORDER.map((automationType) => (
          <AutomationTypeCard
            key={automationType}
            automationType={automationType}
          />
        ))}
      </div>
    </>
  );
}
