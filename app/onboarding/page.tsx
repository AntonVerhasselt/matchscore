"use client";

import StatusAlert from "@/components/StatusAlert";
import { FootballTeamAvatar } from "@/components/football/FootballTeamAvatar";
import {
  FootballTeamSearch,
  type FootballTeamSearchResult,
} from "@/components/football/FootballTeamSearch";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { completeOnboarding } from "@/lib/onboarding/complete-onboarding-server";
import {
  clearSelectedFootballTeamId,
  readSelectedFootballTeamId,
  storeSelectedFootballTeamId,
} from "@/lib/football/selected-team-storage";
import { useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import { unstable_rethrow } from "next/navigation";
import { Loader2 } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

export default function OnboardingPage() {
  const t = useTranslations("onboarding");
  const tHero = useTranslations("landing.hero");
  const [storedTeamId, setStoredTeamId] = useState<Id<"footballTeams"> | null>(
    null,
  );
  const [hasLoadedStoredTeam, setHasLoadedStoredTeam] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<Id<"footballTeams"> | null>(
    null,
  );
  const [selectedTeam, setSelectedTeam] =
    useState<FootballTeamSearchResult | null>(null);
  const [isChangingTeam, setIsChangingTeam] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const teamId = readSelectedFootballTeamId();
    setStoredTeamId(teamId);
    if (teamId) {
      setSelectedTeamId(teamId);
      setIsChangingTeam(false);
    } else {
      setIsChangingTeam(true);
    }
    setHasLoadedStoredTeam(true);
  }, []);

  const storedTeam = useQuery(
    api.football.queries.getFootballTeamForSelection,
    hasLoadedStoredTeam && storedTeamId && !isChangingTeam
      ? { footballTeamId: storedTeamId }
      : "skip",
  );

  const isResolvingStoredTeam =
    hasLoadedStoredTeam &&
    storedTeamId !== null &&
    !isChangingTeam &&
    storedTeam === undefined;

  const storedTeamMissing =
    hasLoadedStoredTeam &&
    storedTeamId !== null &&
    !isChangingTeam &&
    storedTeam === null;

  useEffect(() => {
    if (storedTeamMissing) {
      clearSelectedFootballTeamId();
      setStoredTeamId(null);
      setSelectedTeamId(null);
      setSelectedTeam(null);
      setIsChangingTeam(true);
    }
  }, [storedTeamMissing]);

  useEffect(() => {
    if (storedTeam && !isChangingTeam) {
      setSelectedTeam(storedTeam);
      setSelectedTeamId(storedTeam._id);
    }
  }, [isChangingTeam, storedTeam]);

  const showConfirmation =
    !isChangingTeam &&
    !isResolvingStoredTeam &&
    selectedTeamId !== null &&
    selectedTeam !== null;

  const handleTeamChange = (
    teamId: Id<"footballTeams"> | null,
    team: FootballTeamSearchResult | null,
  ) => {
    setSelectedTeamId(teamId);
    setSelectedTeam(team);
    if (teamId && team) {
      storeSelectedFootballTeamId(teamId);
      setIsChangingTeam(false);
      setError(null);
    }
  };

  const handleChangeTeam = () => {
    setIsChangingTeam(true);
    setSelectedTeamId(null);
    setSelectedTeam(null);
    clearSelectedFootballTeamId();
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!selectedTeamId) {
      setError(t("teamRequired"));
      return;
    }

    setLoading(true);

    try {
      clearSelectedFootballTeamId();
      await completeOnboarding(selectedTeamId);
    } catch (err) {
      unstable_rethrow(err);
      if (selectedTeamId) {
        storeSelectedFootballTeamId(selectedTeamId);
      }
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
          <CardTitle className="font-heading text-3xl uppercase tracking-tight">
            {t("title")}
          </CardTitle>
          <CardDescription>
            {showConfirmation ? t("confirmDescription") : t("description")}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {error && <StatusAlert variant="error">{error}</StatusAlert>}

          <form
            onSubmit={(event) => void handleSubmit(event)}
            className="space-y-4"
          >
            {isResolvingStoredTeam ? (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                {t("pleaseWait")}
              </div>
            ) : showConfirmation && selectedTeam ? (
              <div className="space-y-3">
                <div className="flex items-center gap-4 border bg-muted/30 p-4">
                  <FootballTeamAvatar
                    name={selectedTeam.name}
                    logoUrl={selectedTeam.logoUrl}
                    size="lg"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {t("yourClub")}
                    </p>
                    <p className="truncate font-heading text-lg font-bold uppercase tracking-tight">
                      {selectedTeam.name}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-auto px-0 text-sm font-medium text-muted-foreground hover:text-foreground"
                  onClick={handleChangeTeam}
                  disabled={loading}
                >
                  {t("changeTeam")}
                </Button>
              </div>
            ) : (
              <FootballTeamSearch
                variant="default"
                value={selectedTeamId}
                selectedTeam={selectedTeam}
                onChange={handleTeamChange}
                placeholder={tHero("searchPlaceholder")}
                disabled={loading}
                inputId="teamSearch"
              />
            )}

            <Button
              type="submit"
              className="w-full font-heading uppercase tracking-wide"
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
