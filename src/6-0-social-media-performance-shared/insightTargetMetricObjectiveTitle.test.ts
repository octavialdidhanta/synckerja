import { describe, expect, it } from "vitest";
import { buildInsightMetricObjectiveTitle } from "@/6-0-social-media-performance-shared/insightTargetMetricObjectiveTitle";

describe("buildInsightMetricObjectiveTitle", () => {
  it("formats quarterly metric title", () => {
    const title = buildInsightMetricObjectiveTitle({
      platform: "tiktok",
      accountLabel: "Octa | Work Life Realities",
      metric: "views",
      period: { periodType: "quarterly", year: 2026, quarter: 1 },
    });
    expect(title).toBe("TikTok · Octa | Work Life Realities · Views (Q1 2026)");
  });

  it("formats monthly metric title", () => {
    const title = buildInsightMetricObjectiveTitle({
      platform: "youtube",
      accountLabel: "Octa Vialdi",
      metric: "avg_engagement_rate",
      period: { periodType: "monthly", year: 2026, month: 6 },
    });
    expect(title).toContain("YouTube");
    expect(title).toContain("Avg. engagement");
    expect(title).toContain("2026");
  });
});
