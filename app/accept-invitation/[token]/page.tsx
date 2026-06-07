"use client";

import StatusAlert from "@/components/StatusAlert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { api } from "@/convex/_generated/api";
import { storeInvitationToken } from "@/lib/auth/invitation-token";
import { useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect } from "react";

export default function AcceptInvitationPage() {
  const t = useTranslations("acceptInvitation");
  const tCommon = useTranslations("common");
  const params = useParams<{ token: string }>();
  const token = params.token;

  const invitation = useQuery(api.organizations.queries.getInvitationByToken, {
    token,
  });

  useEffect(() => {
    if (token) {
      storeInvitationToken(token);
    }
  }, [token]);

  if (invitation === undefined) {
    return (
      <main className="flex min-h-svh flex-col items-center justify-center p-6">
        <p className="text-muted-foreground">{tCommon("loading")}</p>
      </main>
    );
  }

  if (!invitation) {
    return (
      <main className="flex min-h-svh flex-col items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <StatusAlert variant="error">{t("invalid")}</StatusAlert>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (invitation.status === "accepted") {
    return (
      <main className="flex min-h-svh flex-col items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <StatusAlert variant="success">{t("alreadyAccepted")}</StatusAlert>
            <Button asChild className="mt-4 w-full">
              <Link href="/sign-in">{t("continueToSignIn")}</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (invitation.expired || invitation.status === "cancelled") {
    return (
      <main className="flex min-h-svh flex-col items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <StatusAlert variant="error">{t("expired")}</StatusAlert>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex min-h-svh flex-col items-center justify-center p-6 sm:p-10">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl">
            {t("title", { organizationName: invitation.organizationName })}
          </CardTitle>
          <CardDescription>
            {t("description", { email: invitation.email })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full">
            <Link href="/sign-in">{t("continueToSignIn")}</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
