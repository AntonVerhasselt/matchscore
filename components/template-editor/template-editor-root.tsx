"use client";

import { useTranslations } from "next-intl";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { AppPageBackLink } from "@/components/app-page";
import { StaticTemplateEditor } from "@/components/template-editor/static-template-editor";
import {
  automationTemplatesPath,
  isAutomationTypeSlug,
  toBackendAutomationType,
  type AutomationTypeSlug,
} from "@/lib/automations/types";
import { useQuery } from "convex/react";

type TemplateEditorRootProps = {
  automationType: string;
  templateId: string;
};

export default function TemplateEditorRoot({
  automationType,
  templateId,
}: TemplateEditorRootProps) {
  const t = useTranslations("app.automations");
  const isValidAutomationType = isAutomationTypeSlug(automationType);
  const slug: AutomationTypeSlug = isValidAutomationType
    ? automationType
    : "result";
  const template = useQuery(
    api.automations.queries.getTemplate,
    isValidAutomationType && templateId !== "new"
      ? { templateId: templateId as Id<"automationTemplates"> }
      : "skip",
  );
  const isMatchingRoute =
    template === undefined ||
    template === null ||
    template.automationType === toBackendAutomationType(slug);

  if (!isValidAutomationType) {
    return null;
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col md:h-screen">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
        <AppPageBackLink href={automationTemplatesPath(slug)}>
          {t("backToTemplates")}
        </AppPageBackLink>
      </header>

      {template === undefined ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-muted-foreground">{t("editor.loading")}</p>
        </div>
      ) : template === null || !isMatchingRoute || templateId === "new" ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-muted-foreground">{t("editor.notFound")}</p>
        </div>
      ) : (
        <StaticTemplateEditor
          key={template._id}
          template={template}
          automationType={slug}
        />
      )}
    </div>
  );
}
