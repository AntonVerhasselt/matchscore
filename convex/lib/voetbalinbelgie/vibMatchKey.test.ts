import { describe, expect, test } from "vitest";

import {
  buildLogicalMatchKey,
  groupMatchesByLogicalKey,
  pickCanonicalMatch,
} from "./matchIdentity";
import {
  buildLegacyVibMatchKey,
  buildVibMatchKey,
} from "./vibMatchKey";

const SOURCE_COMPETITION_ID = 389;
const DATE = "2026-04-26T15:00:00+02:00";
const HOME = "KSV Aartselaar";
const AWAY = "KFC Putte";

describe("buildVibMatchKey", () => {
  test("uses JSON array format", () => {
    expect(buildVibMatchKey(SOURCE_COMPETITION_ID, DATE, HOME, AWAY)).toBe(
      JSON.stringify([SOURCE_COMPETITION_ID, DATE, HOME, AWAY]),
    );
  });

  test("legacy colon format differs from canonical key", () => {
    const legacy = buildLegacyVibMatchKey(
      SOURCE_COMPETITION_ID,
      DATE,
      HOME,
      AWAY,
    );
    const canonical = buildVibMatchKey(SOURCE_COMPETITION_ID, DATE, HOME, AWAY);

    expect(legacy).toBe(`${SOURCE_COMPETITION_ID}:${DATE}:${HOME}:${AWAY}`);
    expect(legacy).not.toBe(canonical);
  });
});

describe("match dedupe helpers", () => {
  const competitionId = "competition123" as never;
  const homeTeamId = "home123" as never;
  const awayTeamId = "away123" as never;
  const kickoffAt = Date.parse(DATE);

  test("pickCanonicalMatch prefers JSON vibMatchKey", () => {
    const legacyKey = buildLegacyVibMatchKey(
      SOURCE_COMPETITION_ID,
      DATE,
      HOME,
      AWAY,
    );
    const canonicalKey = buildVibMatchKey(
      SOURCE_COMPETITION_ID,
      DATE,
      HOME,
      AWAY,
    );

    const legacy = {
      _id: "legacy" as never,
      competitionId,
      vibMatchKey: legacyKey,
      kickoffAt,
      homeTeamId,
      awayTeamId,
      updatedAt: 100,
    };
    const canonical = {
      _id: "canonical" as never,
      competitionId,
      vibMatchKey: canonicalKey,
      kickoffAt,
      homeTeamId,
      awayTeamId,
      updatedAt: 50,
    };

    expect(pickCanonicalMatch([legacy, canonical])._id).toBe("canonical");
  });

  test("groupMatchesByLogicalKey groups legacy and canonical duplicates", () => {
    const legacyKey = buildLegacyVibMatchKey(
      SOURCE_COMPETITION_ID,
      DATE,
      HOME,
      AWAY,
    );
    const canonicalKey = buildVibMatchKey(
      SOURCE_COMPETITION_ID,
      DATE,
      HOME,
      AWAY,
    );

    const groups = groupMatchesByLogicalKey([
      {
        _id: "legacy" as never,
        competitionId,
        vibMatchKey: legacyKey,
        kickoffAt,
        homeTeamId,
        awayTeamId,
        updatedAt: 100,
      },
      {
        _id: "canonical" as never,
        competitionId,
        vibMatchKey: canonicalKey,
        kickoffAt,
        homeTeamId,
        awayTeamId,
        updatedAt: 50,
      },
    ]);

    expect(groups.size).toBe(1);

    const logicalKey = buildLogicalMatchKey({
      competitionId,
      kickoffAt,
      homeTeamId,
      awayTeamId,
    });
    expect(logicalKey).toBe(
      `${competitionId}|${kickoffAt}|${homeTeamId}|${awayTeamId}`,
    );

    const groupedMatches = groups.get(logicalKey);
    expect(groupedMatches).toHaveLength(2);
    expect(groupedMatches?.map((match) => match._id)).toEqual([
      "legacy",
      "canonical",
    ]);
  });

  test("pickCanonicalMatch rejects empty input", () => {
    expect(() => pickCanonicalMatch([])).toThrow(
      "pickCanonicalMatch requires at least one match",
    );
  });
});
