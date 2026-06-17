import { describe, expect, test } from "vitest";

import {
  applyDisplayNameDisambiguation,
  suffixForDuplicateTeam,
} from "./disambiguateTeamNames";

describe("disambiguateTeamNames", () => {
  test("leaves unique team names unchanged", () => {
    const teams = applyDisplayNameDisambiguation([
      { teamName: "KSV Aartselaar", tabLabel: "Mannen" },
      { teamName: "KSV Aartselaar B", tabLabel: "Mannen B" },
    ]);

    expect(teams.map((team) => team.displayName)).toEqual([
      "KSV Aartselaar",
      "KSV Aartselaar B",
    ]);
    expect(teams.every((team) => team.vibTeamName === team.displayName)).toBe(
      true,
    );
  });

  test("suffixes duplicate ASV Geel women's team", () => {
    const teams = applyDisplayNameDisambiguation([
      {
        teamName: "ASV Geel",
        tabLabel: "Mannen",
        competitionPath: "/competities/2025-2026/nationaal/mannen/derde-afdeling-b/",
      },
      {
        teamName: "ASV Geel",
        tabLabel: "Vrouwen",
        competitionPath: "/competities/2025-2026/antwerpen/vrouwen/3b/",
      },
    ]);

    expect(teams[0]?.displayName).toBe("ASV Geel");
    expect(teams[1]?.displayName).toBe("ASV Geel Dames");
    expect(teams[0]?.vibTeamName).toBe("ASV Geel");
    expect(teams[1]?.vibTeamName).toBe("ASV Geel");
  });

  test("suffixes duplicate reserve male team with B", () => {
    const teams = applyDisplayNameDisambiguation([
      { teamName: "Example FC", tabLabel: "Mannen" },
      { teamName: "Example FC", tabLabel: "Mannen B" },
    ]);

    expect(teams[0]?.displayName).toBe("Example FC");
    expect(teams[1]?.displayName).toBe("Example FC B");
  });

  test("uses short Dames suffix for women's teams", () => {
    expect(
      suffixForDuplicateTeam({
        teamName: "ASV Geel",
        tabLabel: "Vrouwen",
      }),
    ).toBe(" Dames");
  });

  test("does not treat derde-afdeling-b competition path as reserve team", () => {
    const teams = applyDisplayNameDisambiguation([
      {
        teamName: "ASV Geel",
        tabLabel: "Mannen",
        competitionPath: "/competities/2025-2026/nationaal/mannen/derde-afdeling-b/",
      },
    ]);

    expect(teams[0]?.displayName).toBe("ASV Geel");
  });

  test("avoids displayName collision when suffix matches another base name", () => {
    const teams = applyDisplayNameDisambiguation([
      { teamName: "Example FC", tabLabel: "Mannen" },
      { teamName: "Example FC B", tabLabel: "Mannen" },
      { teamName: "Example FC", tabLabel: "Mannen B" },
    ]);

    const displayNames = teams.map((team) => team.displayName);
    expect(new Set(displayNames).size).toBe(displayNames.length);
    expect(displayNames).toContain("Example FC");
    expect(displayNames).toContain("Example FC B");
  });
});
