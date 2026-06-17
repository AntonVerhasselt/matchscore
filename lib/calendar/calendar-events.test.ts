import { describe, expect, test } from "vitest";

import {
  buildCalendarEvents,
  findNextUpcomingMatchKickoffAt,
  groupEventsByDay,
  toBrusselsDayKey,
} from "./calendar-events";

describe("buildCalendarEvents", () => {
  const matches = [
    {
      _id: "match1",
      kickoffAt: Date.parse("2026-06-20T15:00:00+02:00"),
      opponentName: "KFC Putte",
      opponentLogoUrl: "https://example.com/logo.png",
      isHome: true,
      matchStatus: "upcoming" as const,
    },
  ];

  test("creates match and automation events when automations are enabled", () => {
    const events = buildCalendarEvents(
      matches,
      {
        matchAnnouncementEnabled: true,
        matchResultEnabled: true,
      },
      "en-BE",
      {
        announcement: "Preview post",
        result: "Score post",
      },
    );

    expect(events).toHaveLength(3);
    expect(events.filter((event) => event.kind === "match")).toHaveLength(1);
    expect(events.find((event) => event.kind === "match")?.label).toBe(
      "KFC Putte",
    );
    expect(
      events.filter((event) => event.kind === "match_announcement"),
    ).toHaveLength(1);
    expect(events.filter((event) => event.kind === "match_result")).toHaveLength(
      1,
    );

    const announcement = events.find(
      (event) => event.kind === "match_announcement",
    );
    expect(announcement?.dayKey).not.toBe(
      toBrusselsDayKey(matches[0]!.kickoffAt),
    );
  });

  test("omits automation events when automations are disabled", () => {
    const events = buildCalendarEvents(
      matches,
      {
        matchAnnouncementEnabled: false,
        matchResultEnabled: false,
      },
      "en-BE",
      {
        announcement: "Preview post",
        result: "Score post",
      },
    );

    expect(events).toHaveLength(1);
    expect(events[0]?.kind).toBe("match");
  });

  test("groupEventsByDay buckets events by Brussels day key", () => {
    const events = buildCalendarEvents(
      matches,
      {
        matchAnnouncementEnabled: false,
        matchResultEnabled: false,
      },
      "en-BE",
      {
        announcement: "Preview post",
        result: "Score post",
      },
    );

    const grouped = groupEventsByDay(events);
    expect(grouped.get(toBrusselsDayKey(matches[0]!.kickoffAt))).toHaveLength(1);
  });
});

describe("findNextUpcomingMatchKickoffAt", () => {
  test("returns the earliest upcoming match from now", () => {
    const now = Date.parse("2026-06-01T12:00:00+02:00");
    const kickoffAt = findNextUpcomingMatchKickoffAt(
      [
        {
          kickoffAt: Date.parse("2026-05-20T15:00:00+02:00"),
          matchStatus: "upcoming",
        },
        {
          kickoffAt: Date.parse("2026-06-20T15:00:00+02:00"),
          matchStatus: "upcoming",
        },
        {
          kickoffAt: Date.parse("2026-07-10T15:00:00+02:00"),
          matchStatus: "upcoming",
        },
      ],
      now,
    );

    expect(kickoffAt).toBe(Date.parse("2026-06-20T15:00:00+02:00"));
  });

  test("returns null when no upcoming matches remain", () => {
    const now = Date.parse("2026-08-01T12:00:00+02:00");
    const kickoffAt = findNextUpcomingMatchKickoffAt(
      [
        {
          kickoffAt: Date.parse("2026-06-20T15:00:00+02:00"),
          matchStatus: "played",
        },
        {
          kickoffAt: Date.parse("2026-07-10T15:00:00+02:00"),
          matchStatus: "upcoming",
        },
      ],
      now,
    );

    expect(kickoffAt).toBeNull();
  });
});
