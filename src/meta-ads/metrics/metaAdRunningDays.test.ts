import { describe, expect, it } from "vitest";
import { metaAdCtrPercent, metaAdRunningDays, metaAdRunningDaysTone } from "@/meta-ads/metrics/metaAdRunningDays";

describe("metaAdRunningDays", () => {
  const now = new Date(2026, 9, 4, 15, 0, 0);

  it("counts the creation day as day 1", () => {
    expect(metaAdRunningDays(new Date(2026, 9, 4, 1), now)).toBe(1);
    expect(metaAdRunningDays(new Date(2026, 9, 1, 8), now)).toBe(4);
  });

  it("returns null when the ad has no created time", () => {
    expect(metaAdRunningDays(null, now)).toBeNull();
    expect(metaAdRunningDays("not-a-date", now)).toBeNull();
  });
});

describe("metaAdRunningDaysTone", () => {
  it("ignores CTR through day 14", () => {
    expect(metaAdRunningDaysTone(2, 1.5)).toBe("week-green");
    expect(metaAdRunningDaysTone(2, 0.4)).toBe("week-green");
    expect(metaAdRunningDaysTone(7, 0.2)).toBe("week-green");
    expect(metaAdRunningDaysTone(8, 0.4)).toBe("week-lime");
    expect(metaAdRunningDaysTone(14, 1.2)).toBe("week-lime");
  });

  it("uses CTR only after day 14", () => {
    expect(metaAdRunningDaysTone(15, 0.4)).toBe("ctr-red");
    expect(metaAdRunningDaysTone(21, 2.5)).toBe("ctr-green");
    expect(metaAdRunningDaysTone(30, 1.4)).toBe("ctr-yellow");
    expect(metaAdRunningDaysTone(45, 2)).toBe("ctr-yellow");
    expect(metaAdRunningDaysTone(45, 1)).toBe("ctr-yellow");
    expect(metaAdRunningDaysTone(45, 0.99)).toBe("ctr-red");
    expect(metaAdRunningDaysTone(45, 2.01)).toBe("ctr-green");
    expect(metaAdCtrPercent("1.25")).toBe(1.25);
  });
});
