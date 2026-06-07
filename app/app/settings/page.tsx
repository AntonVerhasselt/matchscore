"use client";

import LanguageSwitcher from "@/components/LanguageSwitcher";
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
      <h1 className="mb-8 text-3xl tracking-tight text-foreground">
        {t("title")}
      </h1>

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
