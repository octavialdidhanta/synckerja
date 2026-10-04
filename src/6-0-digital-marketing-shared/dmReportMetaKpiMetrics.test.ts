import { describe, expect, it } from "vitest";
import { buildDmAccountActuals, metaKpiActualFromSummary } from "@/6-0-digital-marketing-shared/dmReportTargetActuals";
import { aggregateEfficiencyActualFromAccounts } from "@/6-0-digital-marketing-shared/dmReportTargetMetricAggregate";
import { dmActualOnTargetScale } from "@/6-0-digital-marketing-shared/dmReportTargetPeriod";

const summary = {
  spend: 50000,
  impressions: 10000,
  clicks: 100,
  currency: "IDR",
  content_views: 200,
  adds_to_cart: 20,
  purchases: 5,
  purchase_conversion_value: 1000000,
  view_to_atc_rate: 10,
  atc_to_purchase_rate: 25,
  aov: 200000,
};

describe("Meta KPI target metrics", () => {
  it("reads CPM, funnel rates, and AOV on the target scale", () => {
    expect(metaKpiActualFromSummary(summary, "cpm")).toBe(5000);
    expect(metaKpiActualFromSummary(summary, "view_to_atc_rate")).toBe(10);
    expect(metaKpiActualFromSummary(summary, "atc_to_purchase_rate")).toBe(25);
    expect(metaKpiActualFromSummary(summary, "aov")).toBe(200000);
    expect(dmActualOnTargetScale("view_to_atc_rate", 10)).toBe(10);
  });

  it("keeps the percent rates when blending account actuals", () => {
    const actuals = buildDmAccountActuals({
      channel: "meta",
      accountId: "meta-1",
      selectedMetricKeys: ["cpm", "view_to_atc_rate", "atc_to_purchase_rate", "aov"],
      connected: true,
      currencyCode: "IDR",
      metaTikTokSummary: summary,
    });
    const map = new Map([["meta:meta-1", actuals]]);
    expect(aggregateEfficiencyActualFromAccounts("cpm", map, null, null)).toBe(5000);
    expect(aggregateEfficiencyActualFromAccounts("view_to_atc_rate", map, null, null)).toBe(10);
    expect(aggregateEfficiencyActualFromAccounts("atc_to_purchase_rate", map, null, null)).toBe(25);
    expect(aggregateEfficiencyActualFromAccounts("aov", map, null, null)).toBe(200000);
  });
});
