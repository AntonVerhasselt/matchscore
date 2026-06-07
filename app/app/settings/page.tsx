"use client";

import LanguageSwitcher from "@/components/LanguageSwitcher";
import AppHeader, { AppHeaderLink } from "@/components/AppHeader";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useTranslations } from "next-intl";

export default function SettingsPage() {
  const t = useTranslations("settings");
  const tApp = useTranslations("app");
  const tNav = useTranslations("common.nav");

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-2xl">
        <AppHeader title={t("title")}>
          <AppHeaderLink href="/app">{tApp("title")}</AppHeaderLink>
          <AppHeaderLink href="/">{tNav("home")}</AppHeaderLink>
        </AppHeader>

        <Card>
          <CardHeader>
            <CardTitle id="language-settings-title">{t("language")}</CardTitle>
            <CardDescription>{t("languageDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <LanguageSwitcher
              variant="full"
              triggerAriaLabelledBy="language-settings-title"
            />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
