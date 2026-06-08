"use client";

import { useTranslations } from "next-intl";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { AppPageBackLink } from "@/components/app-page";
import { Badge } from "@/components/ui/badge";
import {
  automationTemplatesPath,
  isAutomationTypeSlug,
  toBackendAutomationType,
  type AutomationTypeSlug,
} from "@/lib/automations/types";
import { CANVAS_PRESET_LABELS } from "@/lib/automations/canvas-presets";
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
  const isNew = templateId === "new";
  const template = useQuery(
    api.automations.queries.getTemplate,
    isNew
      ? "skip"
      : { templateId: templateId as Id<"automationTemplates"> },
  );

  if (!isAutomationTypeSlug(automationType)) {
    return null;
  }

  const slug = automationType as AutomationTypeSlug;
  const isMatchingRoute =
    template === undefined ||
    template === null ||
    template.automationType === toBackendAutomationType(slug);

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col md:h-screen">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
        <AppPageBackLink href={automationTemplatesPath(slug)}>
          {t("backToTemplates")}
        </AppPageBackLink>
        <h1 className="truncate text-sm font-medium">
          {template?.name ?? (isNew ? t("editor.newTemplate") : t("editor.loading"))}
        </h1>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center bg-muted/30 p-8 text-center">
        {template === undefined ? (
          <p className="text-sm text-muted-foreground">{t("editor.loading")}</p>
        ) : template === null || !isMatchingRoute ? (
          <p className="text-sm text-muted-foreground">{t("editor.notFound")}</p>
        ) : (
          <>
            <p className="text-lg font-medium">{t("editor.placeholderTitle")}</p>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              {t("editor.placeholderDescription")}
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Badge variant="secondary">{template.name}</Badge>
              <Badge variant="outline">{t(`types.${slug}.title`)}</Badge>
              <Badge variant="outline">
                {CANVAS_PRESET_LABELS[template.canvasPreset]}
              </Badge>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
