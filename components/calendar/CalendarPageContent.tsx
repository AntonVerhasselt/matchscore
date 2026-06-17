"use client";

import { CalendarSkeleton } from "@/components/calendar/CalendarSkeleton";
import { FootballCalendar } from "@/components/calendar/FootballCalendar";
import { MatchList } from "@/components/calendar/MatchList";
import StatusAlert from "@/components/StatusAlert";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { api } from "@/convex/_generated/api";
import {
  buildCalendarEvents,
  findNextUpcomingMatchKickoffAt,
  groupEventsByDay,
} from "@/lib/calendar/calendar-events";
import { getCurrentBrusselsMonth } from "@/lib/calendar/month-grid";
import { useQuery } from "convex/react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";

export function CalendarPageContent() {
  const t = useTranslations("app.calendar");
  const locale = useLocale();
  const initialMonth = getCurrentBrusselsMonth();
  const [monthState, setMonthState] = useState(initialMonth);

  const accessStatus = useQuery(api.football.queries.getCalendarAccessStatus);
  const matches = useQuery(api.football.queries.listTeamMatches, { limit: 200 });
  const automations = useQuery(api.automations.queries.listAutomations);

  const isLoading =
    accessStatus === undefined ||
    matches === undefined ||
    automations === undefined;

  const automationFlags = useMemo(() => {
    const announcement = automations?.find(
      (item) => item.automationType === "match_announcement",
    );
    const result = automations?.find(
      (item) => item.automationType === "match_result",
    );

    return {
      matchAnnouncementEnabled: announcement?.isGloballyEnabled ?? false,
      matchResultEnabled: result?.isGloballyEnabled ?? false,
    };
  }, [automations]);

  const calendarEvents = useMemo(() => {
    if (!matches) {
      return [];
    }

    return buildCalendarEvents(matches, automationFlags, locale, {
      announcement: t("automationAnnouncement"),
      result: t("automationResult"),
    });
  }, [automationFlags, locale, matches, t]);

  const eventsByDay = useMemo(
    () => groupEventsByDay(calendarEvents),
    [calendarEvents],
  );

  const automationOnlyEvents = useMemo(
    () =>
      calendarEvents.filter(
        (event) =>
          event.kind === "match_announcement" ||
          event.kind === "match_result",
      ),
    [calendarEvents],
  );

  const nextGameKickoffAt = useMemo(
    () => (matches ? findNextUpcomingMatchKickoffAt(matches) : null),
    [matches],
  );

  if (isLoading) {
    return <CalendarSkeleton />;
  }

  if (accessStatus.messageKey === "calendar_not_allowlisted") {
    return (
      <Alert>
        <AlertDescription>{t("access.notAllowlisted")}</AlertDescription>
      </Alert>
    );
  }

  if (accessStatus.messageKey === "calendar_no_competition") {
    return (
      <Alert>
        <AlertDescription>{t("access.noCompetition")}</AlertDescription>
      </Alert>
    );
  }

  if (accessStatus.messageKey === "calendar_sync_error") {
    return (
      <div className="space-y-6">
        <StatusAlert variant="error">
          {t("access.syncError", {
            error: accessStatus.lastSyncError ?? t("access.unknownError"),
          })}
        </StatusAlert>
        {matches.length > 0 ? (
          <>
            <FootballCalendar
              year={monthState.year}
              month={monthState.month}
              eventsByDay={eventsByDay}
              nextGameKickoffAt={nextGameKickoffAt}
              onMonthChange={(year, month) => setMonthState({ year, month })}
            />
            <MatchList
              matches={matches}
              automationEvents={automationOnlyEvents}
            />
          </>
        ) : null}
      </div>
    );
  }

  if (
    accessStatus.messageKey === "calendar_sync_pending" &&
    matches.length === 0
  ) {
    return <CalendarSkeleton />;
  }

  return (
    <div className="space-y-8">
      <FootballCalendar
        year={monthState.year}
        month={monthState.month}
        eventsByDay={eventsByDay}
        nextGameKickoffAt={nextGameKickoffAt}
        onMonthChange={(year, month) => setMonthState({ year, month })}
      />
      <MatchList matches={matches} automationEvents={automationOnlyEvents} />
    </div>
  );
}
