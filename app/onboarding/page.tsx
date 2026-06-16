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
import type { Id } from "@/convex/_generated/dataModel";
import { completeOnboarding } from "@/lib/onboarding/complete-onboarding-server";
import { useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import { unstable_rethrow } from "next/navigation";
import { FormEvent, useState } from "react";

export default function OnboardingPage() {
  const t = useTranslations("onboarding");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState<Id<"footballTeams"> | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const trimmedQuery = searchQuery.trim();
  const searchResults = useQuery(
    api.football.queries.searchFootballTeams,
    trimmedQuery.length >= 2 ? { query: trimmedQuery } : "skip",
  );

  const selectedTeam =
    selectedTeamId && searchResults
      ? searchResults.find((team) => team._id === selectedTeamId)
      : null;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!selectedTeamId) {
      setError(t("teamRequired"));
      return;
    }

    setLoading(true);

    try {
      await completeOnboarding(selectedTeamId);
    } catch (err) {
      unstable_rethrow(err);
      const message =
        err instanceof Error
          ? err.message
          : typeof err === "string"
            ? err
            : t("createFailed");
      setError(message || t("createFailed"));
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
              <Label htmlFor="teamSearch">{t("teamSearch")}</Label>
              <Input
                id="teamSearch"
                value={searchQuery}
                onChange={(event) => {
                  setSearchQuery(event.target.value);
                  setSelectedTeamId(null);
                }}
                placeholder={t("teamSearchPlaceholder")}
                autoComplete="off"
              />
              {trimmedQuery.length >= 2 && searchResults && (
                <ul className="rounded-md border bg-background text-sm">
                  {searchResults.length === 0 ? (
                    <li className="px-3 py-2 text-muted-foreground">
                      {t("noTeamsFound")}
                    </li>
                  ) : (
                    searchResults.map((team) => (
                      <li key={team._id}>
                        <button
                          type="button"
                          className={`w-full px-3 py-2 text-left hover:bg-muted ${
                            selectedTeamId === team._id ? "bg-muted" : ""
                          }`}
                          onClick={() => {
                            setSelectedTeamId(team._id);
                            setSearchQuery(team.name);
                          }}
                        >
                          <span className="font-medium">{team.name}</span>
                          {team.competitionPath && (
                            <span className="mt-0.5 block text-xs text-muted-foreground">
                              {team.competitionPath}
                            </span>
                          )}
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              )}
              {selectedTeam && (
                <p className="text-sm text-muted-foreground">
                  {t("selectedTeam", { name: selectedTeam.name })}
                </p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={loading || !selectedTeamId}
            >
              {loading ? t("pleaseWait") : t("submit")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
