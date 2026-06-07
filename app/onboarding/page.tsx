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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/convex/_generated/api";
import { useMutation } from "convex/react";
import { useTranslations } from "next-intl";
import { FormEvent, useState } from "react";

export default function OnboardingPage() {
  const t = useTranslations("onboarding");
  const createOrganization = useMutation(
    api.organizations.mutations.createOrganization,
  );
  const [clubName, setClubName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await createOrganization({ name: clubName });
      window.location.assign("/app");
    } catch {
      setError(t("createFailed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex flex-1 flex-col items-center justify-center p-6 sm:p-10">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl">{t("title")}</CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {error && <StatusAlert variant="error">{error}</StatusAlert>}

          <form
            onSubmit={(event) => void handleSubmit(event)}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="clubName">{t("clubName")}</Label>
              <Input
                id="clubName"
                value={clubName}
                onChange={(event) => setClubName(event.target.value)}
                placeholder={t("clubNamePlaceholder")}
                required
                autoComplete="organization"
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={loading || !clubName.trim()}
            >
              {loading ? t("pleaseWait") : t("submit")}
            </Button>
          </form>
        </CardContent>

      </Card>
    </main>
  );
}
