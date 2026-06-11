import { describe, expect, it } from "vitest";
import { endOfDay, startOfDay } from "date-fns";
import {
  resolveCumulativeWeekRange,
  targetRowToPeriodKey,
} from "@/6-0-social-media-performance-shared/fetchInsightWeeklyCumulativeActuals";
import type { SocialMediaInsightTargetRow } from "@/6-0-social-media-performance-shared/socialMediaInsightTargetTypes";

describe("targetRowToPeriodKey", () => {
  it("maps quarterly target row to period key", () => {
    const row = {
      period_type: "quarterly",
      year: 2026,
      quarter: 1,
      month: null,
    } as SocialMediaInsightTargetRow;

    expect(targetRowToPeriodKey(row)).toEqual({
      periodType: "quarterly",
      year: 2026,
      quarter: 1,
    });
  });

  it("maps monthly target row to period key", () => {
    const row = {
      period_type: "monthly",
      year: 2026,
      month: 3,
      quarter: null,
    } as SocialMediaInsightTargetRow;

    expect(targetRowToPeriodKey(row)).toEqual({
      periodType: "monthly",
      year: 2026,
      month: 3,
    });
  });
});

describe("resolveCumulativeWeekRange", () => {
  const periodStart = startOfDay(new Date(2026, 0, 1));
  const periodEnd = endOfDay(new Date(2026, 2, 31));
  const now = new Date(2026, 1, 15);

  it("returns null for future weeks", () => {
    const weekEnd = endOfDay(new Date(2026, 3, 10));
    expect(
      resolveCumulativeWeekRange({
        periodStart,
        periodEnd,
        weekEnd,
        isFuture: true,
        now,
      }),
    ).toBeNull();
  });

  it("clamps cumulative end to today when week extends beyond now", () => {
    const weekEnd = endOfDay(new Date(2026, 1, 20));
    const range = resolveCumulativeWeekRange({
      periodStart,
      periodEnd,
      weekEnd,
      isFuture: false,
      now,
    });

    expect(range).not.toBeNull();
    expect(range!.dateStart).toBe("2026-01-01");
    expect(range!.dateEnd).toBe("2026-02-15");
  });

  it("uses week end when week is fully in the past", () => {
    const weekEnd = endOfDay(new Date(2026, 0, 10));
    const range = resolveCumulativeWeekRange({
      periodStart,
      periodEnd,
      weekEnd,
      isFuture: false,
      now,
    });

    expect(range).not.toBeNull();
    expect(range!.dateStart).toBe("2026-01-01");
    expect(range!.dateEnd).toBe("2026-01-10");
  });
});
