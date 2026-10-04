import { describe, expect, it } from "vitest";
import { META_ADS_CPAS_PRESET_METRIC_KEYS } from "@/meta-ads/metrics/metaAdsMetricCatalog";
import { summarySlotKeysFromMetricKeys } from "@/meta-ads/metrics/metaAdsSummaryMetrics";

describe("summarySlotKeysFromMetricKeys", () => {
  it("uses four CPAS cards defaulting to cost, impressions, CPM, and CTR", () => {
    expect(
      summarySlotKeysFromMetricKeys(
        ["impressions", "cpm", "cpc", "ctr", "clicks"],
        "campaign",
      ),
    ).toEqual(["spend", "impressions", "cpm", "ctr"]);
    expect(summarySlotKeysFromMetricKeys(META_ADS_CPAS_PRESET_METRIC_KEYS, "ad")).toEqual([
      "spend",
      "impressions",
      "cpm",
      "ctr",
    ]);
  });

  it("uses four funnel cards for the click-to-ATC column set", () => {
    expect(
      summarySlotKeysFromMetricKeys(
        [
          "clicks",
          "click_to_view_rate",
          "content_views",
          "view_to_atc_rate",
          "adds_to_cart",
          "atc_conversion_value",
        ],
        "campaign",
      ),
    ).toEqual(["spend", "click_to_view_rate", "view_to_atc_rate", "atc_conversion_value"]);
  });

  it("uses four purchase cards for the ATC-to-AOV column set", () => {
    expect(
      summarySlotKeysFromMetricKeys(
        [
          "adds_to_cart",
          "atc_to_purchase_rate",
          "purchases",
          "purchase_conversion_value",
          "cost_per_purchase",
          "aov",
        ],
        "campaign",
      ),
    ).toEqual([
      "atc_to_purchase_rate",
      "purchase_conversion_value",
      "cost_per_purchase",
      "aov",
    ]);
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
