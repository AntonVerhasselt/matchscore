"use client";

import { useTranslations } from "next-intl";

import { AppPageBackLink } from "@/components/app-page";
import { Button } from "@/components/ui/button";
import {
  automationTemplatesPath,
  isAutomationTypeSlug,
  type AutomationTypeSlug,
} from "@/lib/automations/types";
import { showSuccessToast } from "@/lib/user-feedback";

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

  if (!isAutomationTypeSlug(automationType)) {
    return null;
  }

  const slug = automationType as AutomationTypeSlug;

  const handleSave = () => {
    showSuccessToast(t("editor.saveSuccess"));
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col md:h-screen">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
        <AppPageBackLink href={automationTemplatesPath(slug)}>
          {t("backToTemplates")}
        </AppPageBackLink>
        <h1 className="truncate text-sm font-medium">
          {isNew
            ? t("editor.newTemplate")
            : t("editor.editTemplate", { id: templateId })}
        </h1>
        <div className="ml-auto">
          <Button size="sm" onClick={handleSave}>
            {t("editor.save")}
          </Button>
        </div>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center bg-muted/30 p-8 text-center">
        <p className="text-lg font-medium">{t("editor.placeholderTitle")}</p>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          {t("editor.placeholderDescription")}
        </p>
        <p className="mt-4 text-xs text-muted-foreground">
          {t(`types.${slug}.title`)} ·{" "}
          {isNew ? t("editor.newTemplate") : templateId}
        </p>
      </div>
    </div>
  );
}
