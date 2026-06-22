import { describe, expect, it } from "vitest";
import { mapStripeSubscriptionStatus } from "../billing/helpers";

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
