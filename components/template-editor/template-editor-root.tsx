"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { StaticTemplateEditor } from "@/components/template-editor/static-template-editor";
import { Button } from "@/components/ui/button";
import {
  automationTemplatesPath,
  isAutomationTypeSlug,
  toBackendAutomationType,
  type AutomationTypeSlug,
} from "@/lib/automations/types";
import { useQuery } from "convex/react";
import { Monitor } from "lucide-react";
import { useEffect, useState } from "react";

const DESKTOP_EDITOR_MIN_WIDTH_PX = 1024;

function useCanRenderDesktopEditor() {
  const [canRender, setCanRender] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return window.matchMedia(`(min-width: ${DESKTOP_EDITOR_MIN_WIDTH_PX}px)`).matches;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia(
      `(min-width: ${DESKTOP_EDITOR_MIN_WIDTH_PX}px)`,
    );
    const onChange = () => {
      setCanRender(mediaQuery.matches);
    };

    onChange();
    mediaQuery.addEventListener("change", onChange);
    return () => mediaQuery.removeEventListener("change", onChange);
  }, []);

  return canRender;
}

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
  const canRenderDesktopEditor = useCanRenderDesktopEditor();
  const template = useQuery(
    api.automations.queries.getTemplate,
    isValidAutomationType && templateId !== "new" && canRenderDesktopEditor
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
      <div className="flex flex-1 flex-col lg:hidden">
        <EditorFallbackHeader
          backHref={automationTemplatesPath(slug)}
          label={t("backToTemplates")}
        />
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <Monitor className="mb-4 size-12 text-muted-foreground" aria-hidden />
          <h1 className="text-lg font-semibold">
            {t("editor.viewportTooSmallTitle")}
          </h1>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            {t("editor.viewportTooSmallDescription")}
          </p>
        </div>
      </div>

      <div className="hidden min-h-0 flex-1 flex-col lg:flex">
        {templateId === "new" ? (
          <>
            <EditorFallbackHeader
              backHref={automationTemplatesPath(slug)}
              label={t("backToTemplates")}
            />
            <div className="flex flex-1 items-center justify-center">
              <p className="text-sm text-muted-foreground">
                {t("editor.notFound")}
              </p>
            </div>
          </>
        ) : template === undefined ? (
          <>
            <EditorFallbackHeader
              backHref={automationTemplatesPath(slug)}
              label={t("backToTemplates")}
            />
            <div className="flex flex-1 items-center justify-center">
              <p className="text-sm text-muted-foreground">
                {t("editor.loading")}
              </p>
            </div>
          </>
        ) : template === null || !isMatchingRoute ? (
          <>
            <EditorFallbackHeader
              backHref={automationTemplatesPath(slug)}
              label={t("backToTemplates")}
            />
            <div className="flex flex-1 items-center justify-center">
              <p className="text-sm text-muted-foreground">
                {t("editor.notFound")}
              </p>
            </div>
          </>
        ) : (
          <StaticTemplateEditor
            key={template._id}
            template={template}
            automationType={slug}
            backHref={automationTemplatesPath(slug)}
          />
        )}
      </div>
    </div>
  );
}

function EditorFallbackHeader({
  backHref,
  label,
}: {
  backHref: string;
  label: string;
}) {
  return (
    <header className="flex h-14 shrink-0 items-center border-b px-4">
      <Button
        variant="ghost"
        size="icon-sm"
        className="-ml-2"
        aria-label={label}
        asChild
      >
        <Link href={backHref}>
          <ArrowLeft aria-hidden />
        </Link>
      </Button>
    </header>
  );
}
