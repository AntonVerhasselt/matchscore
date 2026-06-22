import { describe, expect, it } from "vitest";

import { formatSubscriptionStatusLabel } from "./format-subscription-status";

const labels = {
  active: "Active",
  pastDue: "Past due",
  canceled: "Canceled",
  none: "None",
  canceling: "Canceling",
};

describe("formatSubscriptionStatusLabel", () => {
  it("shows canceling when active subscription is set to end", () => {
    expect(formatSubscriptionStatusLabel("active", true, labels)).toBe(
      "Canceling",
    );
  });

  it("shows active when subscription is not scheduled to cancel", () => {
    expect(formatSubscriptionStatusLabel("active", false, labels)).toBe(
      "Active",
    );
  });

  it("maps other statuses", () => {
    expect(formatSubscriptionStatusLabel("past_due", false, labels)).toBe(
      "Past due",
    );
    expect(formatSubscriptionStatusLabel("canceled", false, labels)).toBe(
      "Canceled",
    );
  });
});
