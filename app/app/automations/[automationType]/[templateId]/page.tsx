"use client";

import dynamic from "next/dynamic";
import { notFound, useParams } from "next/navigation";

import { TemplateEditorSkeleton } from "@/components/template-editor/template-editor-skeleton";
import { isAutomationTypeSlug } from "@/lib/automations/types";

const TemplateEditorRoot = dynamic(
  () => import("@/components/template-editor/template-editor-root"),
  {
    ssr: false,
    loading: () => <TemplateEditorSkeleton />,
  },
);

export default function TemplateEditorPage() {
  const params = useParams<{ automationType: string; templateId: string }>();

  if (!isAutomationTypeSlug(params.automationType)) {
    notFound();
  }

  return (
    <TemplateEditorRoot
      automationType={params.automationType}
      templateId={params.templateId}
    />
  );
}
