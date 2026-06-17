import { describe, expect, test } from "vitest";

import { selectSampleMatch } from "./select-sample-match";

const now = Date.parse("2026-04-15T12:00:00+02:00");

const matches = [
  {
    id: "past-played",
    kickoffAt: Date.parse("2026-04-01T15:00:00+02:00"),
    status: "Gespeeld",
    homeGoals: 1,
    awayGoals: 0,
  },
  {
    id: "future",
    kickoffAt: Date.parse("2026-04-20T15:00:00+02:00"),
    status: "Gepland",
  },
  {
    id: "older-played",
    kickoffAt: Date.parse("2026-03-01T15:00:00+01:00"),
    status: "Gespeeld",
    homeGoals: 3,
    awayGoals: 3,
  },
];

describe("selectSampleMatch", () => {
  test("announcement picks next future match", () => {
    const selected = selectSampleMatch(matches, "match_announcement", now);
    expect(selected?.id).toBe("future");
  });

  test("announcement falls back to most recent past match", () => {
    const onlyPast = matches.filter((match) => match.id !== "future");
    const selected = selectSampleMatch(
      onlyPast,
      "match_announcement",
      now,
    );
    expect(selected?.id).toBe("past-played");
  });

  test("result picks most recent played match", () => {
    const selected = selectSampleMatch(matches, "match_result", now);
    expect(selected?.id).toBe("past-played");
  });

  test("result ignores future fixtures without scores", () => {
    const onlyFuture = matches.filter((match) => match.id === "future");
    expect(selectSampleMatch(onlyFuture, "match_result", now)).toBeNull();
  });
});
