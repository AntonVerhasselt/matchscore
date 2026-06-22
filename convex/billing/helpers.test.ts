import { describe, expect, it } from "vitest";
import {
  hasManageableSubscription,
  mapStripeSubscriptionStatus,
} from "../billing/helpers";

describe("mapStripeSubscriptionStatus", () => {
  it("maps active and trialing to active", () => {
    expect(mapStripeSubscriptionStatus("active")).toBe("active");
    expect(mapStripeSubscriptionStatus("trialing")).toBe("active");
  });

  it("maps terminal states to canceled", () => {
    expect(mapStripeSubscriptionStatus("canceled")).toBe("canceled");
    expect(mapStripeSubscriptionStatus("unpaid")).toBe("canceled");
  });
});

describe("hasManageableSubscription", () => {
  it("returns true for active or past_due paid subscriptions", () => {
    expect(
      hasManageableSubscription({ plan: "pro", subscriptionStatus: "active" }),
    ).toBe(true);
    expect(
      hasManageableSubscription({
        plan: "elite",
        subscriptionStatus: "past_due",
      }),
    ).toBe(true);
  });

  it("returns false for none, lifetime, or canceled subscriptions", () => {
    expect(
      hasManageableSubscription({ plan: "none", subscriptionStatus: "none" }),
    ).toBe(false);
    expect(
      hasManageableSubscription({
        plan: "lifetime",
        subscriptionStatus: "none",
      }),
    ).toBe(false);
    expect(
      hasManageableSubscription({
        plan: "minimum",
        subscriptionStatus: "canceled",
      }),
    ).toBe(false);
  });
});
