"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  automationEditorPath,
  type AutomationTypeSlug,
} from "@/lib/automations/types";

type CreateTemplateButtonProps = {
  automationType: AutomationTypeSlug;
};

export function CreateTemplateButton({
  automationType,
}: CreateTemplateButtonProps) {
  const t = useTranslations("app.automations.templates");

  return (
    <Button asChild>
      <Link href={automationEditorPath(automationType, "new")}>
        <Plus aria-hidden />
        {t("create")}
      </Link>
    </Button>
  );
}
