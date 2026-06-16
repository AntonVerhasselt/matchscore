import { describe, expect, test } from "vitest";

import { normalizeLogoSourceUrl } from "../../voetbalinbelgie/logos";

describe("logos", () => {
  test("normalizeLogoSourceUrl accepts trusted absolute urls", () => {
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

  test("normalizeLogoSourceUrl rejects untrusted absolute urls", () => {
    expect(() =>
      normalizeLogoSourceUrl("https://evil.example.com/logo.png"),
    ).toThrow("Untrusted logo URL host: evil.example.com");
  });

  test("normalizeLogoSourceUrl rejects unsupported protocols", () => {
    expect(() =>
      normalizeLogoSourceUrl("ftp://www.voetbalinbelgie.be/logo.png"),
    ).toThrow("Unsupported logo URL protocol: ftp:");
  });
});
