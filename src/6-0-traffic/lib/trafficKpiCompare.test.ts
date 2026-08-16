import { describe, expect, it } from "vitest";
import {
  computeTrafficKpiCompareDelta,
  formatTrafficCompareDateRange,
} from "@/6-0-traffic/lib/trafficKpiCompare";

describe("computeTrafficKpiCompareDelta", () => {
  it("returns null when either side is missing", () => {
    expect(computeTrafficKpiCompareDelta(null, 4)).toBeNull();
    expect(computeTrafficKpiCompareDelta(5, null)).toBeNull();
  });

  it("formats an increase against yesterday", () => {
    expect(computeTrafficKpiCompareDelta(5, 4)).toEqual({
      percent: 25,
      direction: "up",
      formattedPercent: "25%",
    });
  });

  it("formats a decrease", () => {
    const delta = computeTrafficKpiCompareDelta(8, 10);
    expect(delta?.direction).toBe("down");
    expect(delta?.formattedPercent).toBe("20%");
  });

  it("uses one decimal when abs percent is under 10", () => {
    expect(computeTrafficKpiCompareDelta(103, 100)?.formattedPercent).toBe("3%");
    expect(computeTrafficKpiCompareDelta(105, 100)?.formattedPercent).toBe("5%");
    expect(computeTrafficKpiCompareDelta(101.5, 100)?.formattedPercent).toBe("1.5%");
  });

  it("shows 0% when both periods are zero", () => {
    expect(computeTrafficKpiCompareDelta(0, 0)).toEqual({
      percent: 0,
      direction: "flat",
      formattedPercent: "0%",
    });
  });

  it("shows an em dash when previous is zero and current is not", () => {
    expect(computeTrafficKpiCompareDelta(5, 0)).toEqual({
      percent: null,
      direction: "flat",
      formattedPercent: "—",
    });
  });
});

describe("formatTrafficCompareDateRange", () => {
  const now = new Date(2026, 7, 16);

  it("formats a single day without year in the current year", () => {
    expect(formatTrafficCompareDateRange("2026-08-15", "2026-08-15", now)).toBe("15 Aug");
  });

  it("collapses a same-month range", () => {
    expect(formatTrafficCompareDateRange("2026-06-01", "2026-06-30", now)).toBe("1–30 Jun");
  });

  it("formats a cross-month range without repeating year", () => {
    expect(formatTrafficCompareDateRange("2026-06-18", "2026-07-17", now)).toBe("18 Jun–17 Jul");
  });

  it("includes year when the range is not this year", () => {
    expect(formatTrafficCompareDateRange("2025-01-01", "2025-12-31", now)).toBe("1 Jan–31 Dec 2025");
  });
});
