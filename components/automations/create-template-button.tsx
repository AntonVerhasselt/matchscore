"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  automationEditorPath,
  toBackendAutomationType,
  type AutomationTypeSlug,
} from "@/lib/automations/types";
import { showErrorToast, showSuccessToast } from "@/lib/user-feedback";
import { useMutation } from "convex/react";

type CreateTemplateButtonProps = {
  automationType: AutomationTypeSlug;
  className?: string;
};

export function CreateTemplateButton({
  automationType,
  className,
}: CreateTemplateButtonProps) {
  const t = useTranslations("app.automations.templates");
  const router = useRouter();
  const createTemplate = useMutation(api.automations.mutations.createTemplate);
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    setIsCreating(true);

    try {
      const templateId = await createTemplate({
        automationType: toBackendAutomationType(automationType),
        canvasPreset: "instagram_square",
        name: t("defaultName"),
      });
      showSuccessToast(t("createSuccess"));
      router.push(automationEditorPath(automationType, templateId));
    } catch {
      showErrorToast(t("createFailed"));
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Button
      type="button"
      className={className}
      disabled={isCreating}
      onClick={() => void handleCreate()}
    >
      <Plus aria-hidden />
      {isCreating ? t("creating") : t("create")}
    </Button>
  );
}
