import { describe, expect, test } from "vitest";

import { formatScore } from "./format-binding";

describe("formatScore", () => {
  test("uses numeric score for standard played matches", () => {
    expect(
      formatScore({
        homeClub: { name: "Home" },
        awayClub: { name: "Away" },
        address: "",
        kickoffAt: 0,
        homeScore: 2,
        awayScore: 1,
        status: "Gespeeld",
      }),
    ).toBe("2 - 1");
  });

  test("uses resultText for non-standard statuses", () => {
    expect(
      formatScore({
        homeClub: { name: "Home" },
        awayClub: { name: "Away" },
        address: "",
        kickoffAt: 0,
        homeScore: 5,
        awayScore: 0,
        status: "Forfait één ploeg",
        resultText: "5 - 0(Forfait)",
      }),
    ).toBe("5 - 0(Forfait)");
  });
});
