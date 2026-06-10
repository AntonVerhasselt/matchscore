"use client";

import { notFound, useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMemo } from "react";

import { api } from "@/convex/_generated/api";
import { AppPageBackLink, AppPageHeader } from "@/components/app-page";
import { CreateTemplateButton } from "@/components/automations/create-template-button";
import { TemplateList } from "@/components/automations/template-list";
import {
  isAutomationTypeSlug,
  toBackendAutomationType,
} from "@/lib/automations/types";
import { useQuery } from "convex/react";

export default function AutomationTemplatesPage() {
  const params = useParams<{ automationType: string }>();
  const automationType = params.automationType;
  const t = useTranslations("app.automations");
  const isValidAutomationType = isAutomationTypeSlug(automationType);
  const slug = isValidAutomationType ? automationType : "result";
  const backendAutomationType = toBackendAutomationType(slug);
  const templates = useQuery(api.automations.queries.listTemplates, {
    automationType: backendAutomationType,
  });
  const automations = useQuery(api.automations.queries.listAutomations);
  const automation = useMemo(
    () =>
      automations?.find(
        (item) => item.automationType === backendAutomationType,
      ),
    [automations, backendAutomationType],
  );

  const isLoading = templates === undefined;
  const templateRows = templates ?? [];
  const templateCount = automation?.templateCount ?? templateRows.length;
  const statusLabel = (automation?.isGloballyEnabled ?? true)
    ? t("templates.statusActive")
    : t("templates.statusInactive");
  const metaDescription = t("templates.meta", {
    count: templateCount,
    status: statusLabel,
  });

  if (!isValidAutomationType) {
    notFound();
  }

  return (
    <>
      <div className="mb-6">
        <AppPageBackLink href="/app/automations">
          {t("backToOverview")}
        </AppPageBackLink>
      </div>

      <AppPageHeader
        className="mb-4"
        title={t(`types.${slug}.title`)}
        description={metaDescription}
      />

      <CreateTemplateButton
        automationType={slug}
        className="mb-8 w-full md:w-fit"
      />

      <TemplateList
        automationType={slug}
        templates={templateRows}
        isLoading={isLoading}
      />
    </>
  );
}
