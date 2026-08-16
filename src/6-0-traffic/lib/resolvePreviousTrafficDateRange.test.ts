import { describe, expect, it } from "vitest";
import {
  computePresetRange,
  toYmdLocal,
  type GoogleAdsDateRangeSelection,
} from "@/6-0-google-ads/lib/googleAdsDatePresets";
import { resolvePreviousTrafficDateRange } from "@/6-0-traffic/lib/resolvePreviousTrafficDateRange";

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
  return resolvePreviousTrafficDateRange(sel, fromDate, toDate);
}

describe("resolvePreviousTrafficDateRange (16 Aug 2026)", () => {
  it("maps today to yesterday", () => {
    const prev = resolve(selection("today"));
    expect(currentYmd(selection("today"))).toEqual({ fromDate: "2026-08-16", toDate: "2026-08-16" });
    expect(prev).toEqual({ fromDate: "2026-08-15", toDate: "2026-08-15", labelKey: "vsYesterday" });
  });

  it("maps yesterday to the day before", () => {
    const prev = resolve(selection("yesterday"));
    expect(currentYmd(selection("yesterday"))).toEqual({ fromDate: "2026-08-15", toDate: "2026-08-15" });
    expect(prev).toEqual({ fromDate: "2026-08-14", toDate: "2026-08-14", labelKey: "vsPreviousDay" });
  });

  it("maps this week to last week Mon–Sun", () => {
    const prev = resolve(selection("this_week_mon_today"));
    expect(currentYmd(selection("this_week_mon_today"))).toEqual({
      fromDate: "2026-08-10",
      toDate: "2026-08-16",
    });
    expect(prev).toEqual({ fromDate: "2026-08-03", toDate: "2026-08-09", labelKey: "vsLastWeek" });
  });

  it("maps last 7 days to the previous 7 days", () => {
    const prev = resolve(selection("last_7_days"));
    expect(currentYmd(selection("last_7_days"))).toEqual({
      fromDate: "2026-08-10",
      toDate: "2026-08-16",
    });
    expect(prev).toEqual({ fromDate: "2026-08-03", toDate: "2026-08-09", labelKey: "vsPreviousPeriod" });
  });

  it("maps last week to the week before", () => {
    const prev = resolve(selection("last_week_mon_sun"));
    expect(currentYmd(selection("last_week_mon_sun"))).toEqual({
      fromDate: "2026-08-03",
      toDate: "2026-08-09",
    });
    expect(prev).toEqual({ fromDate: "2026-07-27", toDate: "2026-08-02", labelKey: "vsPreviousWeek" });
  });

  it("maps last 14 days to the previous 14 days", () => {
    const prev = resolve(selection("last_14_days"));
    expect(currentYmd(selection("last_14_days"))).toEqual({
      fromDate: "2026-08-03",
      toDate: "2026-08-16",
    });
    expect(prev).toEqual({ fromDate: "2026-07-20", toDate: "2026-08-02", labelKey: "vsPreviousPeriod" });
  });

  it("maps this month to last month full", () => {
    const prev = resolve(selection("this_month"));
    expect(currentYmd(selection("this_month"))).toEqual({
      fromDate: "2026-08-01",
      toDate: "2026-08-16",
    });
    expect(prev).toEqual({ fromDate: "2026-07-01", toDate: "2026-07-31", labelKey: "vsLastMonth" });
  });

  it("maps last 30 days to the previous 30 days without overlap", () => {
    const prev = resolve(selection("last_30_days"));
    expect(currentYmd(selection("last_30_days"))).toEqual({
      fromDate: "2026-07-18",
      toDate: "2026-08-16",
    });
    expect(prev).toEqual({ fromDate: "2026-06-18", toDate: "2026-07-17", labelKey: "vsPreviousPeriod" });
  });

  it("maps last month to the month before", () => {
    const prev = resolve(selection("last_month"));
    expect(currentYmd(selection("last_month"))).toEqual({
      fromDate: "2026-07-01",
      toDate: "2026-07-31",
    });
    expect(prev).toEqual({ fromDate: "2026-06-01", toDate: "2026-06-30", labelKey: "vsPreviousMonth" });
  });

  it("maps custom to an equal-length adjacent window", () => {
    const sel: GoogleAdsDateRangeSelection = {
      preset: "custom",
      rollingDays: 30,
      range: {
        from: new Date(2026, 7, 1),
        to: new Date(2026, 7, 10),
      },
    };
    const prev = resolvePreviousTrafficDateRange(sel, "2026-08-01", "2026-08-10");
    expect(prev).toEqual({ fromDate: "2026-07-22", toDate: "2026-07-31", labelKey: "vsPreviousPeriod" });
  });

  it("maps calendar year to the previous full year", () => {
    const prev = resolve(selection("calendar_year", { calendarYear: 2026 }));
    expect(prev).toEqual({ fromDate: "2025-01-01", toDate: "2025-12-31", labelKey: "vsPreviousYear" });
  });

  it("hides comparison for all time", () => {
    const prev = resolve(selection("all_time"));
    expect(prev).toBeNull();
  });
});
