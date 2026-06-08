"use client";

import { Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";

import { DeleteTemplateDialog } from "@/components/automations/delete-template-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CANVAS_PRESET_LABELS } from "@/lib/automations/canvas-presets";
import {
  automationEditorPath,
  type AutomationTypeSlug,
  type MockTemplate,
} from "@/lib/automations/types";
import { showSuccessToast } from "@/lib/user-feedback";

type TemplateListItemProps = {
  template: MockTemplate;
  automationType: AutomationTypeSlug;
  onDelete: (templateId: string) => void;
};

export function TemplateListItem({
  template,
  automationType,
  onDelete,
}: TemplateListItemProps) {
  const t = useTranslations("app.automations.templates");
  const format = useFormatter();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const handleDeleteConfirm = () => {
    onDelete(template.id);
    setDeleteOpen(false);
    showSuccessToast(t("deleteSuccess"));
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
              {format.relativeTime(template.updatedAt)}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button variant="ghost" size="icon-sm" asChild>
            <Link
              href={automationEditorPath(automationType, template.id)}
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
        onConfirm={handleDeleteConfirm}
      />
    </>
  );
}
