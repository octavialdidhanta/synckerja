import { describe, expect, it } from "vitest";
import {
  computeKpiCompareDelta,
  formatCompareDateRange,
  kpiCompareTone,
} from "@/6-0-digital-marketing-shared/lib/kpiPeriodCompare";

describe("computeKpiCompareDelta", () => {
  it("formats an increase", () => {
    expect(computeKpiCompareDelta(5, 4)).toEqual({
      percent: 25,
      direction: "up",
      formattedPercent: "25%",
    });
  });

  it("formats a decrease", () => {
    const delta = computeKpiCompareDelta(8, 10);
    expect(delta?.direction).toBe("down");
    expect(delta?.formattedPercent).toBe("20%");
  });

  it("shows an em dash when previous is zero and current is not", () => {
    expect(computeKpiCompareDelta(5, 0)?.formattedPercent).toBe("—");
  });
});

describe("kpiCompareTone", () => {
  it("treats a Cost decrease as good", () => {
    expect(kpiCompareTone("down", "spent")).toBe("good");
    expect(kpiCompareTone("down", "cost")).toBe("good");
    expect(kpiCompareTone("down", "cpc")).toBe("good");
    expect(kpiCompareTone("down", "cpa")).toBe("good");
    expect(kpiCompareTone("up", "avg_cost")).toBe("bad");
    expect(kpiCompareTone("up", "spent")).toBe("bad");
    expect(kpiCompareTone("down", "spent")).toBe("good");
    expect(kpiCompareTone("up", "cpm")).toBe("bad");
    expect(kpiCompareTone("down", "cpm")).toBe("good");
  });

  it("treats a clicks decrease as bad", () => {
    expect(kpiCompareTone("down", "clicks")).toBe("bad");
    expect(kpiCompareTone("up", "clicks")).toBe("good");
  });
});

describe("formatCompareDateRange", () => {
  const now = new Date(2026, 7, 16);

  it("collapses a same-month range", () => {
    expect(formatCompareDateRange("2026-07-01", "2026-07-31", now)).toBe("1–31 Jul");
  });

  it("keeps days for a cross-month range by default", () => {
    expect(formatCompareDateRange("2025-05-03", "2025-12-31", now)).toBe("3 May–31 Dec 2025");
  });

  it("drops days for a compact cross-month range", () => {
    expect(formatCompareDateRange("2025-05-03", "2025-12-31", now, { compact: true })).toBe(
      "May–Dec 2025",
    );
  });
});
