"use client";

import { Bot, Calendar, Share2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import type { ComponentProps } from "react";

import { AppUserMenu } from "@/components/app-nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  icon: LucideIcon;
  labelKey: "calendar" | "automations" | "socials";
  isActive: (pathname: string) => boolean;
};

const navItems: NavItem[] = [
  {
    href: "/app",
    icon: Calendar,
    labelKey: "calendar",
    isActive: (pathname) => pathname === "/app",
  },
  {
    href: "/app/automations",
    icon: Bot,
    labelKey: "automations",
    isActive: (pathname) => pathname.startsWith("/app/automations"),
  },
  {
    href: "/app/socials",
    icon: Share2,
    labelKey: "socials",
    isActive: (pathname) => pathname.startsWith("/app/socials"),
  },
];

export function AppSidebar(props: ComponentProps<typeof Sidebar>) {
  const t = useTranslations("app.shell.nav");
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();

  const closeMobileSidebar = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex w-full items-center gap-2 px-2 py-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
              <span className="truncate text-base font-semibold tracking-tight text-sidebar-foreground group-data-[collapsible=icon]:hidden">
                Matchscore
              </span>
              <SidebarTrigger className="ml-auto size-8 group-data-[collapsible=icon]:ml-0 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" />
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const label = t(item.labelKey);
                const active = item.isActive(pathname);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={label}
                      className={cn(
                        active &&
                          "bg-sidebar-accent text-sidebar-accent-foreground",
                      )}
                    >
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        onClick={closeMobileSidebar}
                      >
                        <item.icon />
                        <span>{label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      {!isMobile ? (
        <>
          <SidebarSeparator className="bg-sidebar-border" />
          <SidebarFooter>
            <AppUserMenu variant="sidebar" />
          </SidebarFooter>
        </>
      ) : null}
      <SidebarRail />
    </Sidebar>
  );
}
