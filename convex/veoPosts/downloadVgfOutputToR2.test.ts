import { describe, expect, test } from "vitest";
import {
  assertOutputSizeWithinLimit,
  MAX_VGF_OUTPUT_BYTES,
  parseContentLength,
} from "./downloadVgfOutputToR2";

describe("parseContentLength", () => {
  test("parses valid content-length header", () => {
    const response = new Response(null, {
      headers: { "content-length": "45000000" },
    });
    expect(parseContentLength(response)).toBe(45_000_000);
  });

  test("returns null when header is missing or invalid", () => {
    expect(parseContentLength(new Response(null))).toBeNull();
    expect(
      parseContentLength(
        new Response(null, { headers: { "content-length": "abc" } }),
      ),
    ).toBeNull();
  });
});

describe("assertOutputSizeWithinLimit", () => {
  test("allows sizes within the cap", () => {
    expect(() => assertOutputSizeWithinLimit(MAX_VGF_OUTPUT_BYTES)).not.toThrow();
    expect(() => assertOutputSizeWithinLimit(null)).not.toThrow();
  });

  test("rejects oversized outputs", () => {
    expect(() =>
      assertOutputSizeWithinLimit(MAX_VGF_OUTPUT_BYTES + 1),
    ).toThrow("Compiled video exceeds the maximum allowed size");
  });
});
