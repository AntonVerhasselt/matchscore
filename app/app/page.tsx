"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { authClient } from "@/lib/auth-client";
import AppHeader, {
  AppHeaderAction,
  AppHeaderLink,
} from "@/components/AppHeader";
import StatusAlert from "@/components/StatusAlert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

export default function AppPage() {
  const t = useTranslations("app");
  const tNav = useTranslations("common.nav");
  const user = useQuery(api.auth.getCurrentUser);
  const router = useRouter();

  const handleSignOut = async () => {
    await authClient.signOut();
    router.push("/");
    router.refresh();
  };

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-2xl">
        <AppHeader title={t("title")}>
          <AppHeaderLink href="/">{t("home")}</AppHeaderLink>
          <AppHeaderLink href="/app/settings">{tNav("settings")}</AppHeaderLink>
          <AppHeaderAction onClick={() => void handleSignOut()}>
            {t("signOut")}
          </AppHeaderAction>
        </AppHeader>

        <Card>
          {user === undefined ? (
            <CardHeader className="space-y-3">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-56" />
            </CardHeader>
          ) : user ? (
            <CardHeader>
              <CardTitle>{t("signedInAs")}</CardTitle>
              <CardDescription className="text-base font-medium text-foreground">
                {user.email}
              </CardDescription>
            </CardHeader>
          ) : (
            <CardContent className="space-y-4">
              <StatusAlert variant="error">{t("accountLoadFailed")}</StatusAlert>
              <Button variant="outline" onClick={() => router.refresh()}>
                {t("retry")}
              </Button>
            </CardContent>
          )}
        </Card>
      </div>
    </main>
  );
}
