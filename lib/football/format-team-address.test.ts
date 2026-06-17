import { describe, expect, test } from "vitest";

import { formatTeamAddress } from "./format-team-address";

describe("formatTeamAddress", () => {
  test("joins street and postal city", () => {
    expect(
      formatTeamAddress({
        street: "Sportpark De Klavers, Veldstraat 12",
        postalCode: "2630",
        city: "Aartselaar",
      }),
    ).toBe("Sportpark De Klavers, Veldstraat 12, 2630 Aartselaar");
  });

  test("returns empty string when address is missing", () => {
    expect(formatTeamAddress(undefined)).toBe("");
  });

  test("omits empty parts", () => {
    expect(formatTeamAddress({ city: "Geel" })).toBe("Geel");
  });
});
