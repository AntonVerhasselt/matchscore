import { describe, expect, test } from "vitest";

import {
  ALLOWED_COMPETITION_PATHS,
  isCompetitionPathAllowed,
  normalizeCompetitionPath,
} from "./allowlist";

describe("allowlist", () => {
  test("normalizes paths to trailing slash", () => {
    expect(
      normalizeCompetitionPath("/competities/2025-2026/antwerpen/mannen/2a"),
    ).toBe("/competities/2025-2026/antwerpen/mannen/2a/");
    expect(
      normalizeCompetitionPath("/competities/2025-2026/antwerpen/mannen/2a/"),
    ).toBe("/competities/2025-2026/antwerpen/mannen/2a/");
  });

  test("allows configured competition paths", () => {
    for (const path of ALLOWED_COMPETITION_PATHS) {
      expect(isCompetitionPathAllowed(path)).toBe(true);
      expect(isCompetitionPathAllowed(path.slice(0, -1))).toBe(true);
    }
    expect(
      isCompetitionPathAllowed("/competities/2025-2026/limburg/mannen/2a/"),
    ).toBe(false);
  });
});
