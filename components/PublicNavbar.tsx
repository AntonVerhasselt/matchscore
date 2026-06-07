"use client";

import LanguageSwitcher from "@/components/LanguageSwitcher";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import { getUserInitials } from "@/lib/user-display";
import { useQuery } from "convex/react";
import { Menu } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";

type PublicNavbarProps = {
  authenticated: boolean;
};

function PublicNavbarDashboardLink() {
  const t = useTranslations("common.nav");
  const user = useQuery(api.auth.getCurrentUser);

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

export function PublicNavbar({ authenticated }: PublicNavbarProps) {
  const t = useTranslations("common.nav");
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = () => setMenuOpen(false);

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="text-lg font-semibold tracking-tight text-foreground"
        >
          Matchscore
        </Link>

        {authenticated ? (
          <PublicNavbarDashboardLink />
        ) : (
          <>
            <nav
              className="hidden items-center gap-1 md:flex"
              aria-label={t("menu")}
            >
              <Button variant="ghost" size="sm" asChild>
                <Link href="/#pricing">{t("pricing")}</Link>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/#faq">{t("faq")}</Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/sign-in">{t("cta")}</Link>
              </Button>
              <LanguageSwitcher variant="compact" />
            </nav>

            <div className="flex items-center gap-1 md:hidden">
              <LanguageSwitcher variant="compact" />
              <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label={t("menu")}>
                    <Menu />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-full max-w-xs">
                  <SheetHeader>
                    <SheetTitle>{t("menu")}</SheetTitle>
                  </SheetHeader>
                  <nav className="flex flex-col gap-2 px-4">
                    <Button
                      variant="ghost"
                      className="justify-start"
                      asChild
                    >
                      <Link href="/#pricing" onClick={closeMenu}>
                        {t("pricing")}
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      className="justify-start"
                      asChild
                    >
                      <Link href="/#faq" onClick={closeMenu}>
                        {t("faq")}
                      </Link>
                    </Button>
                    <Button className="mt-2" asChild>
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
