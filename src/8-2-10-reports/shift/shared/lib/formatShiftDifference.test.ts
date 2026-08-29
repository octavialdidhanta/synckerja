import { describe, expect, it } from "vitest";
import { formatShiftDifference } from "./formatShiftDifference";

describe("formatShiftDifference", () => {
  it("formats zero as plain money", () => {
    expect(formatShiftDifference(0)).toMatch(/^Rp\.\s?0$/);
  });

  it("wraps shortage in parentheses", () => {
    expect(formatShiftDifference(-4000)).toMatch(/^\(Rp\.\s?4\.000\)$/);
  });

  it("formats overage without parentheses", () => {
    expect(formatShiftDifference(4000)).toMatch(/^Rp\.\s?4\.000$/);
  });

  it("returns dash for null", () => {
    expect(formatShiftDifference(null)).toBe("—");
  });
});
