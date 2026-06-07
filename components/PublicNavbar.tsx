"use client";

import LanguageSwitcher from "@/components/LanguageSwitcher";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import { getUserInitials } from "@/lib/user-display";
import { useQuery } from "convex/react";
import { cn } from "@/lib/utils";
import { Menu } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";

type PublicNavbarProps = {
  authenticated: boolean;
  theme?: "default" | "brand";
};

function PublicNavbarDashboardLink() {
  const t = useTranslations("common.nav");
  const user = useQuery(api.auth.queries.getCurrentUser);

  if (user === undefined) {
    return (
      <Button disabled className="h-auto gap-2.5 px-4 py-2.5">
        <Skeleton className="size-7 rounded-full" />
        {t("goToDashboard")}
      </Button>
    );
  }

  const initials = user ? getUserInitials(user) : "?";

  return (
    <Button asChild className="h-auto gap-2.5 px-4 py-2.5">
      <Link href="/app" className="gap-2.5">
        <Avatar className="size-7">
          <AvatarFallback className="bg-primary-foreground/90 text-xs font-medium text-primary">
            {initials}
          </AvatarFallback>
        </Avatar>
        {t("goToDashboard")}
      </Link>
    </Button>
  );
}

export function PublicNavbar({
  authenticated,
  theme = "default",
}: PublicNavbarProps) {
  const t = useTranslations("common.nav");
  const [menuOpen, setMenuOpen] = useState(false);
  const isBrand = theme === "brand";

  const closeMenu = () => setMenuOpen(false);

  const navLinkClass = isBrand
    ? "text-sidebar-foreground/85 hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground"
    : undefined;

  const menuIconClass = isBrand
    ? "text-sidebar-foreground hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground"
    : undefined;

  return (
    <header
      className={cn(
        "sticky top-0 z-40 w-full border-b pt-[env(safe-area-inset-top)]",
        isBrand
          ? "border-sidebar-border/40 bg-sidebar text-sidebar-foreground"
          : "border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80",
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:h-[4.5rem] sm:px-8 lg:px-10">
        <Link
          href="/"
          className={cn(
            "shrink-0 font-heading text-lg tracking-tight uppercase sm:text-xl md:text-2xl",
            isBrand ? "text-sidebar-foreground" : "text-foreground",
          )}
        >
          Matchscore
        </Link>

        {authenticated ? (
          <PublicNavbarDashboardLink />
        ) : (
          <>
            <nav
              className="hidden items-center gap-0.5 lg:flex"
              aria-label={t("menu")}
            >
              <Button variant="ghost" size="sm" className={navLinkClass} asChild>
                <Link href="/#features">{t("features")}</Link>
              </Button>
              <Button variant="ghost" size="sm" className={navLinkClass} asChild>
                <Link href="/#how-it-works">{t("howItWorks")}</Link>
              </Button>
              <Button variant="ghost" size="sm" className={navLinkClass} asChild>
                <Link href="/#pricing">{t("pricing")}</Link>
              </Button>
              <Button variant="ghost" size="sm" className={navLinkClass} asChild>
                <Link href="/#faq">{t("faq")}</Link>
              </Button>
              <Button
                size="sm"
                variant={isBrand ? "secondary" : "default"}
                className={
                  isBrand
                    ? "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90"
                    : undefined
                }
                asChild
              >
                <Link href="/sign-in">{t("cta")}</Link>
              </Button>
              <LanguageSwitcher
                variant="compact"
                tone={isBrand ? "inverse" : "default"}
              />
            </nav>

            <div className="flex items-center gap-1 lg:hidden">
              <LanguageSwitcher
                variant="compact"
                tone={isBrand ? "inverse" : "default"}
              />
              <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
                <SheetTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn("size-11", menuIconClass)}
                    aria-label={t("menu")}
                  >
                    <Menu />
                  </Button>
                </SheetTrigger>
                <SheetContent
                  side="right"
                  className="w-full max-w-[min(100%,20rem)] gap-0 pb-[env(safe-area-inset-bottom)]"
                >
                  <SheetHeader className="border-b border-border px-2 pb-4">
                    <SheetTitle className="font-heading text-lg uppercase">
                      {t("menu")}
                    </SheetTitle>
                    <SheetDescription className="sr-only">
                      {t("menu")}
                    </SheetDescription>
                  </SheetHeader>
                  <nav className="flex flex-col gap-1 px-3 pt-4">
                    <Button
                      variant="ghost"
                      className="h-12 justify-start text-base font-semibold"
                      asChild
                    >
                      <Link href="/#features" onClick={closeMenu}>
                        {t("features")}
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      className="h-12 justify-start text-base font-semibold"
                      asChild
                    >
                      <Link href="/#how-it-works" onClick={closeMenu}>
                        {t("howItWorks")}
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      className="h-12 justify-start text-base font-semibold"
                      asChild
                    >
                      <Link href="/#pricing" onClick={closeMenu}>
                        {t("pricing")}
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      className="h-12 justify-start text-base font-semibold"
                      asChild
                    >
                      <Link href="/#faq" onClick={closeMenu}>
                        {t("faq")}
                      </Link>
                    </Button>
                    <Button
                      className={cn(
                        "mt-4 h-12 w-full text-base",
                        isBrand &&
                          "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90",
                      )}
                      asChild
                    >
                      <Link href="/sign-in" onClick={closeMenu}>
                        {t("cta")}
                      </Link>
                    </Button>
                  </nav>
                </SheetContent>
              </Sheet>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
