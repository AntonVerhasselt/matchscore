export type CalendarEventKind =
  | "match"
  | "match_announcement"
  | "match_result";

export type CalendarEvent = {
  id: string;
  kind: CalendarEventKind;
  dayKey: string;
  kickoffAt: number;
  /** Short label shown in the calendar bar */
  label: string;
  /** Full description for native tooltip */
  tooltip: string;
  timeLabel: string;
  opponentName: string;
  opponentLogoUrl: string | null;
};

export type TeamMatchForCalendar = {
  _id: string;
  kickoffAt: number;
  opponentName: string;
  opponentLogoUrl: string | null;
  isHome: boolean;
  homeGoals?: number;
  awayGoals?: number;
  matchStatus: "upcoming" | "played";
};

export function findNextUpcomingMatchKickoffAt(
  matches: Array<Pick<TeamMatchForCalendar, "kickoffAt" | "matchStatus">>,
  now = Date.now(),
): number | null {
  const nextMatch = matches
    .filter(
      (match) => match.matchStatus === "upcoming" && match.kickoffAt >= now,
    )
    .sort((a, b) => a.kickoffAt - b.kickoffAt)[0];

  return nextMatch?.kickoffAt ?? null;
}

export type AutomationFlags = {
  matchAnnouncementEnabled: boolean;
  matchResultEnabled: boolean;
};

const ANNOUNCEMENT_LEAD_MS = 2 * 24 * 60 * 60 * 1000;
const BRUSSELS_TZ = "Europe/Brussels";

export function toBrusselsDayKey(timestampMs: number): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BRUSSELS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(timestampMs));
}

export function formatBrusselsTime(
  timestampMs: number,
  locale: string,
): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: BRUSSELS_TZ,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestampMs));
}

export function buildCalendarEvents(
  matches: TeamMatchForCalendar[],
  automations: AutomationFlags,
  locale: string,
  labels: {
    announcement: string;
    result: string;
  },
): CalendarEvent[] {
  const events: CalendarEvent[] = [];

  for (const match of matches) {
    const timeLabel = formatBrusselsTime(match.kickoffAt, locale);
    const homeAway = match.isHome ? "vs" : "@";
    const matchTooltip = `${timeLabel} ${homeAway} ${match.opponentName}`;

    events.push({
      id: `match-${match._id}`,
      kind: "match",
      dayKey: toBrusselsDayKey(match.kickoffAt),
      kickoffAt: match.kickoffAt,
      label: match.opponentName,
      tooltip: matchTooltip,
      timeLabel,
      opponentName: match.opponentName,
      opponentLogoUrl: match.opponentLogoUrl,
    });

    if (automations.matchAnnouncementEnabled) {
      const announcementAt = match.kickoffAt - ANNOUNCEMENT_LEAD_MS;
      events.push({
        id: `announcement-${match._id}`,
        kind: "match_announcement",
        dayKey: toBrusselsDayKey(announcementAt),
        kickoffAt: announcementAt,
        label: labels.announcement,
        tooltip: `${labels.announcement}: ${match.opponentName}`,
        timeLabel: formatBrusselsTime(announcementAt, locale),
        opponentName: match.opponentName,
        opponentLogoUrl: match.opponentLogoUrl,
      });
    }

    if (automations.matchResultEnabled) {
      events.push({
        id: `result-${match._id}`,
        kind: "match_result",
        dayKey: toBrusselsDayKey(match.kickoffAt),
        kickoffAt: match.kickoffAt,
        label: labels.result,
        tooltip: `${labels.result}: ${match.opponentName}`,
        timeLabel,
        opponentName: match.opponentName,
        opponentLogoUrl: match.opponentLogoUrl,
      });
    }
  }

  return events.sort((a, b) => a.kickoffAt - b.kickoffAt);
}

export function groupEventsByDay(
  events: CalendarEvent[],
): Map<string, CalendarEvent[]> {
  const grouped = new Map<string, CalendarEvent[]>();

  for (const event of events) {
    const dayEvents = grouped.get(event.dayKey) ?? [];
    dayEvents.push(event);
    grouped.set(event.dayKey, dayEvents);
  }

  for (const dayEvents of grouped.values()) {
    dayEvents.sort((a, b) => a.kickoffAt - b.kickoffAt);
  }

  return grouped;
}
