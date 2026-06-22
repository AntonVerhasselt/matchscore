"use client";

import type { ReactNode } from "react";
import { Suspense, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

import { AppUserMenu } from "@/components/app-nav-user";
import { AppSidebar } from "@/components/app-sidebar";
import { CheckoutFeedback } from "@/components/billing/CheckoutFeedback";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { isEditorRoute } from "@/lib/automations/types";
import { cn } from "@/lib/utils";

function SidebarEditorSync() {
  const pathname = usePathname();
  const isEditor = isEditorRoute(pathname);
  const { setOpen } = useSidebar();
  const wasEditor = useRef(isEditor);

  useEffect(() => {
    if (isEditor) {
      setOpen(false);
    } else if (wasEditor.current) {
      setOpen(true);
    }

    wasEditor.current = isEditor;
  }, [isEditor, setOpen]);

  return null;
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isEditor = isEditorRoute(pathname);

  return (
    <TooltipProvider>
      <SidebarProvider defaultOpen={!isEditor}>
        <SidebarEditorSync />
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-14 shrink-0 items-center justify-between bg-sidebar px-5 py-3 text-sidebar-foreground md:hidden">
            <SidebarTrigger className="size-9 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" />
            <AppUserMenu variant="header" />
          </header>
          <main
            className={cn(
              "flex flex-1 flex-col",
              isEditor ? "p-0" : "p-5 md:p-10",
            )}
          >
            <div
              className={cn(
                "mx-auto w-full",
                isEditor ? "max-w-none" : "max-w-4xl",
              )}
            >
              <Suspense fallback={null}>
                <CheckoutFeedback />
              </Suspense>
              {children}
            </div>
          </main>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
