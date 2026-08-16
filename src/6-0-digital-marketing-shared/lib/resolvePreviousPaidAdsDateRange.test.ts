import { describe, expect, it } from "vitest";
import {
  computePresetRange,
  toYmdLocal,
  type GoogleAdsDateRangeSelection,
} from "@/6-0-google-ads/lib/googleAdsDatePresets";
import { resolvePreviousPaidAdsDateRange } from "@/6-0-digital-marketing-shared/lib/resolvePreviousPaidAdsDateRange";

const NOW = new Date(2026, 7, 16, 12, 0, 0);

function selection(
  preset: GoogleAdsDateRangeSelection["preset"],
  extra?: Partial<GoogleAdsDateRangeSelection>,
): GoogleAdsDateRangeSelection {
  return {
    preset,
    range: computePresetRange(preset, NOW, {
      calendarYear: extra?.calendarYear,
      calendarQuarter: extra?.calendarQuarter,
    }),
    rollingDays: extra?.rollingDays ?? 30,
    calendarYear: extra?.calendarYear,
    calendarQuarter: extra?.calendarQuarter,
  };
}

function currentYmd(sel: GoogleAdsDateRangeSelection) {
  return {
    fromDate: sel.range.from ? toYmdLocal(sel.range.from) : null,
    toDate: sel.range.to ? toYmdLocal(sel.range.to) : null,
  };
}

function resolve(sel: GoogleAdsDateRangeSelection) {
  const { fromDate, toDate } = currentYmd(sel);
  return resolvePreviousPaidAdsDateRange(sel, fromDate, toDate);
}

describe("resolvePreviousPaidAdsDateRange (16 Aug 2026)", () => {
  it("maps today to yesterday", () => {
    expect(resolve(selection("today"))).toEqual({
      fromDate: "2026-08-15",
      toDate: "2026-08-15",
      labelKey: "vsYesterday",
    });
  });

  it("maps this month to last month full", () => {
    expect(resolve(selection("this_month"))).toEqual({
      fromDate: "2026-07-01",
      toDate: "2026-07-31",
      labelKey: "vsLastMonth",
    });
  });

  it("maps last month to the previous month full", () => {
    expect(resolve(selection("last_month"))).toEqual({
      fromDate: "2026-06-01",
      toDate: "2026-06-30",
      labelKey: "vsPreviousMonth",
    });
  });

  it("maps last 30 days to the previous 30 days without overlap", () => {
    expect(resolve(selection("last_30_days"))).toEqual({
      fromDate: "2026-06-18",
      toDate: "2026-07-17",
      labelKey: "vsPreviousPeriod",
    });
  });

  it("hides comparison for all time", () => {
    expect(resolve(selection("all_time"))).toBeNull();
  });
});
