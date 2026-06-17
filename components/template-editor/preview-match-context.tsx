"use client";

import type { TemplateRenderMatchData } from "@/lib/football/template-render-match";
import { createContext, useContext } from "react";

const PreviewMatchContext = createContext<TemplateRenderMatchData | null>(null);

export function PreviewMatchProvider({
  value,
  children,
}: {
  value: TemplateRenderMatchData | null;
  children: React.ReactNode;
}) {
  return (
    <PreviewMatchContext.Provider value={value}>
      {children}
    </PreviewMatchContext.Provider>
  );
}

export function usePreviewMatch(): TemplateRenderMatchData | null {
  return useContext(PreviewMatchContext);
}
