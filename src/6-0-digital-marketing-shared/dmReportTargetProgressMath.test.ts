import { describe, expect, it } from "vitest";
import {
  computeDmReportSummaryDisplayPercentage,
  computeDmReportTargetDeviationPercentage,
  computeDmReportTargetOkrPercentage,
  computeDmReportTargetProgressPercentage,
  dmReportMetricDirection,
} from "@/6-0-digital-marketing-shared/dmReportTargetProgressMath";

describe("dmReportTargetProgressMath", () => {
  it("treats cost as lower-is-better", () => {
    expect(dmReportMetricDirection("cost")).toBe("lower_is_better");
    expect(dmReportMetricDirection("spent")).toBe("lower_is_better");
  });

  it("treats clicks as higher-is-better", () => {
    expect(dmReportMetricDirection("clicks")).toBe("higher_is_better");
  });

  it("shows budget utilization for cost progress bar", () => {
    expect(computeDmReportTargetProgressPercentage(23_619, 25_000, "cost")).toBe(94);
    expect(computeDmReportTargetProgressPercentage(172_855, 125_000, "cost")).toBe(138);
    expect(computeDmReportTargetProgressPercentage(149_236, 100_000, "cost")).toBe(149);
  });

  it("keeps OKR achievement high when under budget", () => {
    expect(computeDmReportTargetOkrPercentage(23_619, 25_000, "cost")).toBe(100);
    expect(computeDmReportTargetOkrPercentage(172_855, 125_000, "cost")).toBe(72);
  });

  it("scores clicks proportionally when higher is better", () => {
    expect(computeDmReportTargetProgressPercentage(50, 100, "clicks")).toBe(50);
    expect(computeDmReportTargetProgressPercentage(120, 100, "clicks")).toBe(100);
  });

  it("shows CPC utilization when over cap and OKR score separately", () => {
    expect(computeDmReportTargetProgressPercentage(5_905, 5_000, "cpc")).toBe(118);
    expect(computeDmReportTargetOkrPercentage(5_905, 5_000, "cpc")).toBe(85);
    expect(computeDmReportTargetProgressPercentage(4_200, 5_000, "cpc")).toBe(84);
    expect(computeDmReportTargetOkrPercentage(4_200, 5_000, "cpc")).toBe(100);
  });

  it("computes deviation for lower-is-better metrics", () => {
    expect(computeDmReportTargetDeviationPercentage(5_905, 5_000, "cpc")).toBe(-18);
    expect(computeDmReportTargetDeviationPercentage(4_200, 5_000, "cpc")).toBe(16);
    expect(computeDmReportTargetDeviationPercentage(5_000, 5_000, "cpc")).toBe(0);
    expect(computeDmReportTargetDeviationPercentage(23_619, 22_500, "cost")).toBe(-5);
  });

  it("computes deviation for higher-is-better metrics", () => {
    expect(computeDmReportTargetDeviationPercentage(50, 100, "clicks")).toBe(-50);
    expect(computeDmReportTargetDeviationPercentage(120, 100, "clicks")).toBe(20);
    expect(computeDmReportTargetDeviationPercentage(100, 100, "clicks")).toBe(0);
  });

  it("report summary bar: Desc under cap is 100%, over cap is below 100%", () => {
    expect(computeDmReportSummaryDisplayPercentage(23_619, 22_500, "cost")).toBe(95);
    expect(computeDmReportSummaryDisplayPercentage(20_000, 22_500, "cost")).toBe(100);
    expect(computeDmReportSummaryDisplayPercentage(1_029, 2_950, "cpc")).toBe(100);
  });

  it("report summary bar: Asc can exceed 100% when above target", () => {
    expect(computeDmReportSummaryDisplayPercentage(23_619, 22_500, "cost", { cost: "higher_is_better" })).toBe(
      105,
    );
    expect(computeDmReportSummaryDisplayPercentage(50, 100, "clicks")).toBe(50);
    expect(computeDmReportSummaryDisplayPercentage(120, 100, "clicks")).toBe(120);
  });
});
