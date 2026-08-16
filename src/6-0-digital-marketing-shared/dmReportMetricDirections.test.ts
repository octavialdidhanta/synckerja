import { describe, expect, it } from "vitest";
import {
  computeDmReportTargetOkrPercentage,
  computeDmReportTargetProgressPercentage,
} from "@/6-0-digital-marketing-shared/dmReportTargetProgressMath";
import {
  dmReportSuggestedCheckinStatus,
  isDmReportActualOnTrackForDirection,
  isDmReportTargetRespectingToggle,
  resolveDmReportMetricDirection,
} from "@/6-0-digital-marketing-shared/dmReportMetricDirections";

describe("dmReportMetricDirections", () => {
  it("overrides CPC to higher-is-better when configured", () => {
    const directions = { cpc: "higher_is_better" as const };
    expect(resolveDmReportMetricDirection("cpc", directions)).toBe("higher_is_better");
    expect(computeDmReportTargetProgressPercentage(5_905, 5_000, "cpc", directions)).toBe(100);
    expect(computeDmReportTargetOkrPercentage(5_905, 5_000, "cpc", directions)).toBe(100);
  });

  it("keeps default lower-is-better for CPC without override", () => {
    expect(computeDmReportTargetProgressPercentage(5_905, 5_000, "cpc")).toBe(118);
    expect(computeDmReportTargetOkrPercentage(5_905, 5_000, "cpc")).toBe(85);
    expect(resolveDmReportMetricDirection("avg_cost")).toBe("lower_is_better");
    expect(resolveDmReportMetricDirection("cpm")).toBe("lower_is_better");
  });

  it("requires desc target ≤ actual and asc target ≥ actual for save", () => {
    expect(isDmReportTargetRespectingToggle(5_000, 5_905, "cpc")).toBe(true);
    expect(isDmReportTargetRespectingToggle(6_000, 5_905, "cpc")).toBe(false);
    expect(isDmReportTargetRespectingToggle(25_000, 23_619, "cost")).toBe(false);
    expect(isDmReportTargetRespectingToggle(1_000, 500, "clicks")).toBe(true);
    expect(isDmReportTargetRespectingToggle(300, 500, "clicks")).toBe(false);
  });

  it("tracks desc as actual ≤ target and asc as actual ≥ target", () => {
    expect(isDmReportActualOnTrackForDirection(5_905, 5_000, "cpc")).toBe(false);
    expect(isDmReportActualOnTrackForDirection(4_200, 5_000, "cpc")).toBe(true);
    expect(isDmReportActualOnTrackForDirection(23_619, 25_000, "cost")).toBe(true);
    expect(isDmReportActualOnTrackForDirection(500, 1_000, "clicks")).toBe(false);
    expect(isDmReportActualOnTrackForDirection(1_200, 1_000, "clicks")).toBe(true);
    expect(dmReportSuggestedCheckinStatus(5_905, 5_000, "cpc")).toBe("off_track");
    expect(dmReportSuggestedCheckinStatus(23_619, 25_000, "cost")).toBe("on_track");
  });
});
