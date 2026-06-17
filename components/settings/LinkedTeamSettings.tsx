"use client";

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
import { showErrorToast, showSuccessToast } from "@/lib/user-feedback";
import { useMutation, useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import { useState } from "react";

export function LinkedTeamSettings() {
  const t = useTranslations("settings.linkedTeam");
  const tHero = useTranslations("landing.hero");
  const membership = useQuery(api.organizations.queries.getCurrentMembership);
  const footballTeamId = membership?.organization.footballTeamId;

  const linkedTeam = useQuery(
    api.football.queries.getFootballTeam,
    footballTeamId ? { footballTeamId } : "skip",
  );
  const teamSummary = useQuery(
    api.football.queries.getFootballTeamForSelection,
    footballTeamId ? { footballTeamId } : "skip",
  );

  const updateLinkedTeam = useMutation(
    api.organizations.mutations.updateOrganizationFootballTeam,
  );

  const [isChanging, setIsChanging] = useState(false);
  const [selectedTeamId, setSelectedTeamId] =
    useState<Id<"footballTeams"> | null>(null);
  const [selectedTeam, setSelectedTeam] =
    useState<FootballTeamSearchResult | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const isLoading =
    membership === undefined ||
    (footballTeamId !== undefined &&
      (linkedTeam === undefined || teamSummary === undefined));

  const hasTeamChange =
    selectedTeamId !== null && selectedTeamId !== footballTeamId;

  const handleSave = async () => {
    if (!hasTeamChange) {
      return;
    }

    setIsSaving(true);
    try {
      await updateLinkedTeam({ footballTeamId: selectedTeamId });
      showSuccessToast(t("changeSuccess"));
      setIsChanging(false);
      setSelectedTeamId(null);
      setSelectedTeam(null);
    } catch {
      showErrorToast(t("changeFailed"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">{t("loading")}</p>
        ) : isChanging ? (
          <div className="space-y-3">
            <FootballTeamSearch
              value={selectedTeamId}
              selectedTeam={selectedTeam}
              onChange={(teamId, team) => {
                setSelectedTeamId(teamId);
                setSelectedTeam(team);
              }}
              placeholder={tHero("searchPlaceholder")}
              disabled={isSaving}
              inputId="settingsTeamSearch"
              autoFocus
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={() => void handleSave()}
                disabled={isSaving || !hasTeamChange}
              >
                {isSaving ? t("saving") : t("save")}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsChanging(false);
                  setSelectedTeamId(null);
                  setSelectedTeam(null);
                }}
                disabled={isSaving}
              >
                {t("cancel")}
              </Button>
            </div>
          </div>
        ) : teamSummary ? (
          <div className="space-y-3">
            <div className="flex items-center gap-4 border bg-muted/30 p-4">
              <FootballTeamAvatar
                name={teamSummary.name}
                logoUrl={teamSummary.logoUrl}
                size="lg"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-heading text-lg font-bold uppercase tracking-tight">
                  {teamSummary.name}
                </p>
                {linkedTeam?.tabLabel ? (
                  <p className="text-sm text-muted-foreground">
                    {linkedTeam.tabLabel}
                  </p>
                ) : null}
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsChanging(true);
                setSelectedTeamId(null);
                setSelectedTeam(null);
              }}
            >
              {t("changeTeam")}
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t("unavailable")}</p>
        )}
      </CardContent>
    </Card>
  );
}
