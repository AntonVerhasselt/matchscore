import { describe, expect, test } from "vitest";

import {
  getCompetitionSyncTtlMs,
  shouldFetchCompetition,
} from "./syncSchedule";

const HOUR = 60 * 60 * 1000;
const MINUTE = 60 * 1000;

describe("syncSchedule", () => {
  test("uses 4 hour TTL on weekdays", () => {
    const mondayMorning = Date.parse("2026-06-15T10:00:00+02:00");
    expect(getCompetitionSyncTtlMs(mondayMorning)).toBe(4 * HOUR);
  });

  test("uses 1 hour TTL on weekend mornings", () => {
    const saturdayMorning = Date.parse("2026-06-13T14:00:00+02:00");
    expect(getCompetitionSyncTtlMs(saturdayMorning)).toBe(1 * HOUR);
  });

  test("uses 15 minute TTL on weekend afternoons from 15:00", () => {
    const saturdayAfternoon = Date.parse("2026-06-13T16:00:00+02:00");
    expect(getCompetitionSyncTtlMs(saturdayAfternoon)).toBe(15 * MINUTE);
  });

  test("shouldFetchCompetition respects TTL unless forced", () => {
    const now = Date.parse("2026-06-15T10:00:00+02:00");
    const twoHoursAgo = now - 2 * HOUR;

    expect(shouldFetchCompetition(undefined, now)).toBe(true);
    expect(shouldFetchCompetition(twoHoursAgo, now)).toBe(false);
    expect(shouldFetchCompetition(twoHoursAgo, now, { force: true })).toBe(
      true,
    );
  });

  test("shouldFetchCompetition fetches again after TTL expires", () => {
    const now = Date.parse("2026-06-15T10:00:00+02:00");
    const fiveHoursAgo = now - 5 * HOUR;

    expect(shouldFetchCompetition(fiveHoursAgo, now)).toBe(true);
  });
});
