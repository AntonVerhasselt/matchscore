import { describe, expect, test } from "vitest";

import { normalizeLogoSourceUrl } from "../../voetbalinbelgie/logos";

describe("logos", () => {
  test("normalizeLogoSourceUrl keeps absolute urls", () => {
    expect(
      normalizeLogoSourceUrl(
        "https://www.voetbalinbelgie.be/images/club_logo.png",
      ),
    ).toBe("https://www.voetbalinbelgie.be/images/club_logo.png");
  });

  test("normalizeLogoSourceUrl resolves relative urls", () => {
    expect(normalizeLogoSourceUrl("/images/club_logo.png")).toBe(
      "https://www.voetbalinbelgie.be/images/club_logo.png",
    );
  });
});
