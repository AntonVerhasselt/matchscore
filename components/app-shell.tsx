"use client";

import type { ReactNode } from "react";

import { AppUserMenu } from "@/components/app-nav-user";
import { AppSidebar } from "@/components/app-sidebar";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-14 shrink-0 items-center justify-between bg-sidebar px-5 py-3 text-sidebar-foreground md:hidden">
            <SidebarTrigger className="size-9 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" />
            <AppUserMenu variant="header" />
          </header>
          <main className="flex flex-1 flex-col p-5 md:p-10">
            <div className="mx-auto w-full max-w-4xl">{children}</div>
          </main>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
