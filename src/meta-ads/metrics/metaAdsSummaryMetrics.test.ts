import { describe, expect, it } from "vitest";
import { summarySlotKeysFromMetricKeys } from "@/meta-ads/metrics/metaAdsSummaryMetrics";

describe("summarySlotKeysFromMetricKeys", () => {
  it("fills the five cards from the column set order", () => {
    expect(
      summarySlotKeysFromMetricKeys(
        ["impressions", "cpm", "cpc", "ctr", "clicks"],
        "campaign",
      ),
    ).toEqual(["impressions", "cpm", "cpc", "ctr", "clicks"]);
  });

  it("skips delivery and budget, then keeps the next summary metrics", () => {
    expect(
      summarySlotKeysFromMetricKeys(
        ["delivery", "budget", "reach", "impressions", "frequency", "cpm", "cpc"],
        "campaign",
      ),
    ).toEqual(["reach", "impressions", "frequency", "cpm", "cpc"]);
  });
});
