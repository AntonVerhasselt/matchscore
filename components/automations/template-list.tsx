"use client";

import { LayoutTemplate } from "lucide-react";
import { useTranslations } from "next-intl";

import { CreateTemplateButton } from "@/components/automations/create-template-button";
import { TemplateListItem } from "@/components/automations/template-list-item";
import type {
  AutomationTemplateSummary,
  AutomationTypeSlug,
} from "@/lib/automations/types";

type TemplateListProps = {
  automationType: AutomationTypeSlug;
  templates: AutomationTemplateSummary[];
};

export function TemplateList({
  automationType,
  templates,
}: TemplateListProps) {
  const t = useTranslations("app.automations.templates");

  if (templates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-none border border-dashed border-border px-6 py-16 text-center">
        <LayoutTemplate
          className="mb-4 size-10 text-muted-foreground"
          aria-hidden
        />
        <h2 className="text-base font-semibold">{t("empty.title")}</h2>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          {t("empty.description")}
        </p>
        <div className="mt-6">
          <CreateTemplateButton automationType={automationType} />
        </div>
      </div>
    );
  }

  return (
    <div>
      {templates.map((template) => (
        <TemplateListItem
          key={template._id}
          template={template}
          automationType={automationType}
        />
      ))}
    </div>
  );
}
