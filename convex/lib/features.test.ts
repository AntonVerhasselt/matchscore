import { describe, expect, it } from "vitest";
import {
  Feature,
  getFeatureBlockReason,
  getOrgFeatureAccess,
  hasFeature,
} from "./features";

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

  it("returns upgrade_required when tier is too low", () => {
    expect(
      getFeatureBlockReason(
        { plan: "pro", subscriptionStatus: "active" },
        Feature.GoalHighlightsGenerate,
      ),
    ).toBe("upgrade_required");
    expect(
      getFeatureBlockReason(
        { plan: "none", subscriptionStatus: "none" },
        Feature.GoalHighlightsGenerate,
      ),
    ).toBe("upgrade_required");
  });

  it("returns subscription_inactive for past_due or canceled paid tiers", () => {
    expect(
      getFeatureBlockReason(
        { plan: "elite", subscriptionStatus: "past_due" },
        Feature.GoalHighlightsGenerate,
      ),
    ).toBe("subscription_inactive");
    expect(
      getFeatureBlockReason(
        { plan: "pro", subscriptionStatus: "canceled" },
        Feature.GoalHighlightsGenerate,
      ),
    ).toBe("subscription_inactive");
  });

  it("returns null when feature is available", () => {
    expect(
      getFeatureBlockReason(
        { plan: "elite", subscriptionStatus: "active" },
        Feature.GoalHighlightsGenerate,
      ),
    ).toBeNull();
  });
});
