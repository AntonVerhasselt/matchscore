"use client";

import LanguageSwitcher from "@/components/LanguageSwitcher";
import { AppPageHeader } from "@/components/app-page";
import { OrganizationMembers } from "@/components/settings/OrganizationMembers";
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

  return (
    <>
      <AppPageHeader title={t("title")} />

      <div className="space-y-6">
        <OrganizationMembers />

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
    </>
  );
}
