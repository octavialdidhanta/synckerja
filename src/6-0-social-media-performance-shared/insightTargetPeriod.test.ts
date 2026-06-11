import { describe, expect, it } from "vitest";
import {
  countDaysInclusive,
  prorateTargetValue,
  resolveInsightTargetPeriod,
} from "@/6-0-social-media-performance-shared/insightTargetPeriod";
import type { GoogleAdsDateRangeSelection } from "@/6-0-google-ads/lib/googleAdsDatePresets";

describe("resolveInsightTargetPeriod", () => {
  it("maps this_month to monthly period", () => {
    const from = new Date(2026, 5, 1);
    const selection: GoogleAdsDateRangeSelection = {
      preset: "this_month",
      rollingDays: 30,
      range: { from, to: new Date(2026, 5, 10) },
    };
    const period = resolveInsightTargetPeriod(selection, new Date(2026, 5, 10));
    expect(period).not.toBeNull();
    expect(period?.periodType).toBe("monthly");
    expect(period?.year).toBe(2026);
    expect(period?.month).toBe(6);
  });

  it("maps calendar_quarter to quarterly period", () => {
    const selection: GoogleAdsDateRangeSelection = {
      preset: "calendar_quarter",
      rollingDays: 30,
      calendarYear: 2026,
      calendarQuarter: 2,
      range: {
        from: new Date(2026, 3, 1),
        to: new Date(2026, 5, 10),
      },
    };
    const period = resolveInsightTargetPeriod(selection, new Date(2026, 5, 10));
    expect(period).not.toBeNull();
    expect(period?.periodType).toBe("quarterly");
    expect(period?.year).toBe(2026);
    expect(period?.quarter).toBe(2);
  });

  it("returns null for last_30_days", () => {
    const selection: GoogleAdsDateRangeSelection = {
      preset: "last_30_days",
      rollingDays: 30,
      range: {
        from: new Date(2026, 4, 12),
        to: new Date(2026, 5, 10),
      },
    };
    expect(resolveInsightTargetPeriod(selection)).toBeNull();
  });
});

describe("prorateTargetValue", () => {
  it("prorates by elapsed days", () => {
    expect(prorateTargetValue(3000, 15, 30)).toBe(1500);
  });

  it("returns 0 for non-positive target", () => {
    expect(prorateTargetValue(0, 10, 30)).toBe(0);
  });
});

describe("countDaysInclusive", () => {
  it("counts inclusive days in a month slice", () => {
    const days = countDaysInclusive(new Date(2026, 5, 1), new Date(2026, 5, 10));
    expect(days).toBe(10);
  });
});
