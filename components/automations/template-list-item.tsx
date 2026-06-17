"use client";

import { Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useFormatter, useNow, useTranslations } from "next-intl";
import { useState } from "react";

import { api } from "@/convex/_generated/api";
import { DeleteTemplateDialog } from "@/components/automations/delete-template-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CANVAS_PRESET_LABELS } from "@/lib/automations/canvas-presets";
import {
  automationEditorPath,
  type AutomationTemplateSummary,
  type AutomationTypeSlug,
} from "@/lib/automations/types";
import { showErrorToast, showSuccessToast } from "@/lib/user-feedback";
import { useMutation } from "convex/react";

type TemplateListItemProps = {
  template: AutomationTemplateSummary;
  automationType: AutomationTypeSlug;
};

export function TemplateListItem({
  template,
  automationType,
}: TemplateListItemProps) {
  const t = useTranslations("app.automations.templates");
  const format = useFormatter();
  const now = useNow();
  const deleteTemplate = useMutation(api.automations.mutations.deleteTemplate);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteConfirm = async () => {
    setIsDeleting(true);

    try {
      await deleteTemplate({ templateId: template._id });
      setDeleteOpen(false);
      showSuccessToast(t("deleteSuccess"));
    } catch {
      showErrorToast(t("deleteFailed"));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-4 border-b border-border py-4 last:border-b-0">
        <div
          className="size-16 shrink-0 bg-muted ring-1 ring-foreground/10"
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{template.name}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Badge variant="outline">
              {CANVAS_PRESET_LABELS[template.canvasPreset]}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {format.relativeTime(template.updatedAt, now)}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button variant="ghost" size="icon-sm" asChild>
            <Link
              href={automationEditorPath(automationType, template._id)}
              aria-label={t("edit")}
            >
              <Pencil aria-hidden />
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setDeleteOpen(true)}
            aria-label={t("delete")}
          >
            <Trash2 aria-hidden />
          </Button>
        </div>
      </div>

      <DeleteTemplateDialog
        templateName={template.name}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={() => void handleDeleteConfirm()}
        isDeleting={isDeleting}
      />
    </>
  );
}
