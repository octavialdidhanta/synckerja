import { describe, expect, it } from "vitest";
import {
  parseGaqlCalendarMonth,
  parseGaqlCalendarYear,
} from "../../../supabase/functions/_shared/googleAdsReportByService.ts";

describe("parseGaqlCalendarMonth", () => {
  it("parses segments.month as yyyy-MM-dd date", () => {
    expect(parseGaqlCalendarMonth({ month: "2024-01-01" })).toBe(1);
    expect(parseGaqlCalendarYear({ month: "2024-01-01" })).toBe(2024);
    expect(parseGaqlCalendarMonth({ month: "2025-06-01" })).toBe(6);
    expect(parseGaqlCalendarYear({ month: "2025-06-01" })).toBe(2025);
  });

  it("parses segments.month_of_year / monthOfYear enum", () => {
    expect(parseGaqlCalendarMonth({ monthOfYear: "JANUARY", year: 2024 })).toBe(1);
    expect(parseGaqlCalendarMonth({ month_of_year: "DECEMBER" })).toBe(12);
    expect(parseGaqlCalendarMonth({ monthOfYear: 2 })).toBe(1);
    expect(parseGaqlCalendarMonth({ monthOfYear: 13 })).toBe(12);
  });

  it("returns 0 for invalid segment month", () => {
    expect(parseGaqlCalendarMonth({ month: "not-a-date" })).toBe(0);
    expect(parseGaqlCalendarMonth(undefined)).toBe(0);
  });
});

describe("parseGaqlCalendarYear", () => {
  it("reads segments.year when present", () => {
    expect(parseGaqlCalendarYear({ year: 2023, monthOfYear: "MARCH" })).toBe(2023);
  });
});
