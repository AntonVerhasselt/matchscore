import { describe, expect, test } from "vitest";

import { buildTemplateMatch } from "./build-template-match";

describe("buildTemplateMatch", () => {
  test("maps home venue address and team logos", () => {
    const dto = buildTemplateMatch({
      kickoffAt: 1_700_000_000_000,
      status: "Gespeeld",
      homeGoals: 2,
      awayGoals: 1,
      resultText: "2 - 1",
      homeTeam: {
        name: "KSV Aartselaar",
        logoStorageId: "homeLogo" as never,
        address: {
          street: "Sportpark De Klavers, Veldstraat 12",
          postalCode: "2630",
          city: "Aartselaar",
        },
      },
      awayTeam: {
        name: "KFC Duffel",
        logoStorageId: "awayLogo" as never,
      },
    });

    expect(dto.homeClub.name).toBe("KSV Aartselaar");
    expect(dto.awayClub.name).toBe("KFC Duffel");
    expect(dto.address).toBe(
      "Sportpark De Klavers, Veldstraat 12, 2630 Aartselaar",
    );
    expect(dto.homeScore).toBe(2);
    expect(dto.awayScore).toBe(1);
    expect(dto.homeClub.logoStorageId).toBe("homeLogo");
  });
});
