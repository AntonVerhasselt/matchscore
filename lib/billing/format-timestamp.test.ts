import { describe, expect, it } from "vitest";

import {
  formatMillisTimestamp,
  formatStripeUnixTimestamp,
} from "./format-timestamp";

describe("formatStripeUnixTimestamp", () => {
  it("converts Stripe seconds to a real calendar date", () => {
    const jan2026 = 1767225600;
    const formatted = formatStripeUnixTimestamp(jan2026, "en-GB");
    expect(formatted).toContain("2026");
    expect(formatted).not.toContain("1970");
  });

  it("returns em dash for missing or zero values", () => {
    expect(formatStripeUnixTimestamp(null)).toBe("—");
    expect(formatStripeUnixTimestamp(0)).toBe("—");
  });
});

describe("formatMillisTimestamp", () => {
  it("formats millisecond timestamps", () => {
    const formatted = formatMillisTimestamp(1767225600000, "en-GB");
    expect(formatted).toContain("2026");
  });
});
