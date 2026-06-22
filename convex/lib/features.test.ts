import { describe, expect, it } from "vitest";
import { Feature, getOrgFeatureAccess, hasFeature } from "./features";

describe("getOrgFeatureAccess", () => {
  it("allows template editing for setup-only orgs", () => {
    const access = getOrgFeatureAccess({ plan: "none", subscriptionStatus: "none" });
    expect(access.automationsEdit).toBe(true);
    expect(access.automationsPost).toBe(false);
    expect(access.goalHighlightsGenerate).toBe(false);
  });

  it("enables posting for active minimum plan with watermark", () => {
    const access = getOrgFeatureAccess({
      plan: "minimum",
      subscriptionStatus: "active",
    });
    expect(access.automationsPost).toBe(true);
    expect(access.automationsWatermark).toBe(true);
    expect(access.goalHighlightsGenerate).toBe(false);
  });

  it("enables goal highlights for elite and lifetime", () => {
    expect(
      hasFeature("elite", "active", Feature.GoalHighlightsGenerate),
    ).toBe(true);
    expect(
      hasFeature("lifetime", "none", Feature.GoalHighlightsGenerate),
    ).toBe(true);
    expect(
      hasFeature("pro", "active", Feature.GoalHighlightsGenerate),
    ).toBe(false);
  });
});
