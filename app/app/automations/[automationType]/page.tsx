"use client";

import { notFound, useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { AppPageBackLink, AppPageHeader } from "@/components/app-page";
import { CreateTemplateButton } from "@/components/automations/create-template-button";
import { TemplateList } from "@/components/automations/template-list";
import { getMockTemplatesForType } from "@/lib/automations/mock-data";
import { isAutomationTypeSlug } from "@/lib/automations/types";

export default function AutomationTemplatesPage() {
  const params = useParams<{ automationType: string }>();
  const automationType = params.automationType;
  const t = useTranslations("app.automations");

  const initialTemplates = useMemo(
    () =>
      isAutomationTypeSlug(automationType)
        ? getMockTemplatesForType(automationType)
        : [],
    [automationType],
  );

  const [templates, setTemplates] = useState(initialTemplates);

  if (!isAutomationTypeSlug(automationType)) {
    notFound();
  }

  const handleDelete = (templateId: string) => {
    setTemplates((prev) => prev.filter((tpl) => tpl.id !== templateId));
  };

  return (
    <>
      <div className="mb-6">
        <AppPageBackLink href="/app/automations">
          {t("backToOverview")}
        </AppPageBackLink>
      </div>

      <AppPageHeader
        className="mb-4"
        title={t(`types.${automationType}.title`)}
        description={t("templates.meta", {
          count: templates.length,
          status: t("templates.statusActive"),
        })}
      />

      <CreateTemplateButton
        automationType={automationType}
        className="mb-8 w-full md:w-fit"
      />

      <TemplateList
        automationType={automationType}
        templates={templates}
        onDelete={handleDelete}
      />
    </>
  );
}
