"use client";

import { FootballTeamAvatar } from "@/components/football/FootballTeamAvatar";
import { Badge } from "@/components/ui/badge";
import type { CalendarEvent } from "@/lib/calendar/calendar-events";
import { formatBrusselsTime } from "@/lib/calendar/calendar-events";
import { useLocale, useTranslations } from "next-intl";

type MatchListProps = {
  matches: Array<{
    _id: string;
    kickoffAt: number;
    opponentName: string;
    opponentLogoUrl: string | null;
    isHome: boolean;
    homeGoals?: number;
    awayGoals?: number;
    matchStatus: "upcoming" | "played";
  }>;
  automationEvents: CalendarEvent[];
};

export function MatchList({ matches, automationEvents }: MatchListProps) {
  const locale = useLocale();
  const t = useTranslations("app.calendar");

  const upcomingMatches = [...matches]
    .filter((match) => match.matchStatus === "upcoming")
    .sort((a, b) => a.kickoffAt - b.kickoffAt);

  if (upcomingMatches.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <h3 className="font-heading text-lg font-bold uppercase tracking-tight">
        {t("matchListTitle")}
      </h3>

      <ul className="divide-y rounded-lg border">
        {upcomingMatches.map((match) => {
          const dateLabel = new Intl.DateTimeFormat(locale, {
            timeZone: "Europe/Brussels",
            weekday: "short",
            day: "numeric",
            month: "short",
          }).format(new Date(match.kickoffAt));
          const timeLabel = formatBrusselsTime(match.kickoffAt, locale);

          return (
            <li
              key={match._id}
              className="flex items-center gap-3 px-4 py-3 sm:px-5"
            >
              <FootballTeamAvatar
                name={match.opponentName}
                logoUrl={match.opponentLogoUrl}
                size="default"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  {match.isHome ? t("homeVs", { opponent: match.opponentName }) : t("awayAt", { opponent: match.opponentName })}
                </p>
                <p className="text-sm text-muted-foreground">
                  {dateLabel} · {timeLabel}
                </p>
              </div>
              <Badge variant="outline">{t("statusUpcoming")}</Badge>
            </li>
          );
        })}
      </ul>

      {automationEvents.length > 0 ? (
        <p className="text-xs text-muted-foreground">{t("automationHint")}</p>
      ) : null}
    </div>
  );
}
