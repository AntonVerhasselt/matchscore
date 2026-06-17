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
  const initialSelectedFootballTeamId = readSelectedFootballTeamId();
  const [storedTeamId] = useState<Id<"footballTeams"> | null>(
    () => initialSelectedFootballTeamId,
  );
  const [isChangingTeam, setIsChangingTeam] = useState(
    () => initialSelectedFootballTeamId === null,
  );
  const [selectedTeamId, setSelectedTeamId] = useState<Id<"footballTeams"> | null>(
    () => initialSelectedFootballTeamId,
  );
  const [selectedTeam, setSelectedTeam] =
    useState<FootballTeamSearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const shouldResolveStoredTeam =
    storedTeamId !== null && !isChangingTeam;

  const storedTeam = useQuery(
    api.football.queries.getFootballTeamForSelection,
    shouldResolveStoredTeam ? { footballTeamId: storedTeamId } : "skip",
  );

  const storedTeamResolvedMissing =
    shouldResolveStoredTeam && storedTeam === null;

  useEffect(() => {
    if (storedTeamResolvedMissing) {
      clearSelectedFootballTeamId();
    }
  }, [storedTeamResolvedMissing]);

  const isChoosingTeam = isChangingTeam || storedTeamResolvedMissing;

  const isResolvingStoredTeam =
    shouldResolveStoredTeam &&
    !storedTeamResolvedMissing &&
    storedTeam === undefined;

  const activeTeamId = isChoosingTeam
    ? selectedTeamId
    : (selectedTeamId ?? storedTeam?._id ?? null);

  const activeTeam = isChoosingTeam
    ? selectedTeam
    : (selectedTeam ?? storedTeam ?? null);

  const showConfirmation =
    !isChoosingTeam &&
    !isResolvingStoredTeam &&
    activeTeamId !== null &&
    activeTeam !== null;

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
    clearSelectedFootballTeamId();
    setIsChangingTeam(true);
    setSelectedTeamId(null);
    setSelectedTeam(null);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!activeTeamId) {
      setError(t("teamRequired"));
      return;
    }

    setLoading(true);

    try {
      clearSelectedFootballTeamId();
      await completeOnboarding(activeTeamId);
    } catch (err) {
      unstable_rethrow(err);
      if (activeTeamId) {
        storeSelectedFootballTeamId(activeTeamId);
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
            ) : showConfirmation && activeTeam ? (
              <div className="space-y-3">
                <div className="flex items-center gap-4 border bg-muted/30 p-4">
                  <FootballTeamAvatar
                    name={activeTeam.name}
                    logoUrl={activeTeam.logoUrl}
                    size="lg"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {t("yourClub")}
                    </p>
                    <p className="truncate font-heading text-lg font-bold uppercase tracking-tight">
                      {activeTeam.name}
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
              disabled={loading || !activeTeamId}
            >
              {loading ? t("pleaseWait") : t("submit")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
