"use client";

import { useQuery } from "convex/react";
import { ChevronsUpDown, LogOut, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import { authClient } from "@/lib/auth-client";
import { getUserDisplayName, getUserInitials } from "@/lib/user-display";
import { cn } from "@/lib/utils";

type AppUserMenuProps = {
  variant?: "sidebar" | "header";
};

export function AppUserMenu({ variant = "sidebar" }: AppUserMenuProps) {
  const t = useTranslations("app.shell.user");
  const user = useQuery(api.auth.getCurrentUser);
  const router = useRouter();
  const pathname = usePathname();
  const { isMobile } = useSidebar();
  const isSettingsActive = pathname.startsWith("/app/settings");

  const handleSignOut = async () => {
    try {
      const result = await authClient.signOut();
      if (result.error) {
        console.error("Sign out failed:", result.error);
        return;
      }
      router.push("/");
      router.refresh();
    } catch (error) {
      console.error("Sign out failed:", error);
    }
  };

  if (variant === "sidebar" && isMobile) {
    return null;
  }

  if (user === undefined) {
    if (variant === "header") {
      return <Skeleton className="size-8 rounded-full" />;
    }

    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg" disabled>
            <Skeleton className="size-8 rounded-lg" />
            <div className="grid flex-1 gap-1 text-left">
              <Skeleton className="h-4 w-24" />
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  if (!user) {
    return null;
  }

  const displayName = getUserDisplayName(user);
  const initials = getUserInitials(user);

  const menuItems = (
    <>
      {variant === "header" ? (
        <>
          <DropdownMenuLabel className="truncate font-normal">
            {displayName}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
        </>
      ) : null}
      <DropdownMenuGroup>
        <DropdownMenuItem asChild>
          <Link
            href="/app/settings"
            className={cn(isSettingsActive && "bg-accent font-medium")}
          >
            <Settings />
            {t("settings")}
          </Link>
        </DropdownMenuItem>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        <DropdownMenuItem onClick={() => void handleSignOut()}>
          <LogOut />
          {t("signOut")}
        </DropdownMenuItem>
      </DropdownMenuGroup>
    </>
  );

  if (variant === "header") {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-9 shrink-0 rounded-full text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <Avatar className="size-8">
              <AvatarFallback className="bg-sidebar-primary text-xs text-sidebar-primary-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
            <span className="sr-only">{displayName}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          side="bottom"
          sideOffset={8}
          className="w-48"
        >
          {menuItems}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="size-8 rounded-lg">
                <AvatarFallback className="rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{displayName}</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-56 rounded-lg"
            side="top"
            align="end"
            sideOffset={4}
          >
            {menuItems}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

/** @deprecated Use AppUserMenu instead */
export const AppNavUser = AppUserMenu;
