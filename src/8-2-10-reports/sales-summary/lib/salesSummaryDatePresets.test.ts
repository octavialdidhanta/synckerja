import { describe, expect, it } from "vitest";
import {
  computeSalesSummaryPresetRange,
  salesSummaryRangeToTimestamps,
} from "./salesSummaryDatePresets";

describe("computeSalesSummaryPresetRange", () => {
  it("returns this month bounds for a fixed anchor", () => {
    const anchor = new Date(2026, 7, 15); // 15 Aug 2026
    const range = computeSalesSummaryPresetRange("this_month", anchor);
    expect(range).toEqual({ from: "2026-08-01", to: "2026-08-31" });
  });

  it("returns today as a single day", () => {
    const anchor = new Date(2026, 7, 20);
    expect(computeSalesSummaryPresetRange("today", anchor)).toEqual({
      from: "2026-08-20",
      to: "2026-08-20",
    });
  });
});

describe("salesSummaryRangeToTimestamps", () => {
  it("builds exclusive all-day window in Asia/Jakarta", () => {
    const ts = salesSummaryRangeToTimestamps({
      fromYmd: "2026-08-01",
      toYmd: "2026-08-31",
      allDay: true,
      startTime: "00:00",
      endTime: "23:59",
    });
    expect(ts.fromIso).toBe("2026-08-01T00:00:00+07:00");
    expect(ts.toIso).toBe("2026-09-01T00:00:00+07:00");
  });

  it("uses custom times when allDay is false", () => {
    const ts = salesSummaryRangeToTimestamps({
      fromYmd: "2026-08-20",
      toYmd: "2026-08-20",
      allDay: false,
      startTime: "09:00",
      endTime: "17:00",
    });
    expect(ts.fromIso).toBe("2026-08-20T09:00:00+07:00");
    expect(ts.toIso).toBe("2026-08-20T17:01:00+07:00");
  });
});
