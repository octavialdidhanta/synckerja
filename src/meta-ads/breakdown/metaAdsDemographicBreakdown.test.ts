import { describe, expect, it } from "vitest";
import {
  BREAKDOWN_RAW_METRIC_KEYS,
  breakdownDerivedMetrics,
  formatBreakdownCompact,
  formatBreakdownDisplay,
} from "@/meta-ads/breakdown/metaAdsBreakdownMetrics";
import {
  DEMOGRAPHIC_METRIC_KEYS,
  aggregateDemographicRows,
  demographicInsightScope,
  readDemographicIds,
  sharedItemInsightScope,
  withSharedItemActions,
  withoutCommerceFields,
} from "../../../supabase/functions/_shared/metaAdsDemographicBreakdown.ts";

describe("meta demographic breakdown", () => {
  it("uses the same raw metric keys on the page and in the edge parser", () => {
    expect([...BREAKDOWN_RAW_METRIC_KEYS].sort()).toEqual([...DEMOGRAPHIC_METRIC_KEYS].sort());
  });

  it("derives frequency, rates, and costs from the raw counts", () => {
    const derived = breakdownDerivedMetrics({
      impressions: 1000,
      reach: 400,
      spend: 5000,
      inline_link_clicks: 20,
      clicks: 40,
      unique_clicks: 30,
      outbound_clicks: 10,
      unique_outbound_clicks: 8,
      content_views: 10,
      adds_to_cart: 4,
      purchases: 2,
      atc_conversion_value: 4000,
      purchase_conversion_value: 10000,
    });
    expect(derived.frequency).toBe(2.5);
    expect(derived.cpm).toBe(5000);
    expect(derived.ctr).toBe(0.02);
    expect(derived.cpc).toBe(250);
    expect(derived.ctr_all).toBe(0.04);
    expect(derived.cpc_all).toBe(125);
    expect(derived.unique_ctr).toBeCloseTo(0.075);
    expect(derived.cost_per_unique_click).toBeCloseTo(5000 / 30);
    expect(derived.outbound_ctr).toBe(0.01);
    expect(derived.cost_per_outbound_click).toBe(500);
    expect(derived.unique_outbound_ctr).toBe(0.02);
    expect(derived.cost_per_unique_outbound_click).toBe(625);
    expect(derived.cost_per_purchase).toBe(2500);
    expect(derived.purchase_roas).toBe(2);
    expect(derived.aov).toBe(5000);
    expect(derived.atc_to_purchase_rate).toBe(0.5);
    expect(formatBreakdownDisplay("ctr", derived.ctr, "IDR", false)).toBe("2.00%");
    expect(formatBreakdownDisplay("frequency", derived.frequency, "IDR", false)).toBe("2.50");
    expect(formatBreakdownDisplay("purchase_roas", derived.purchase_roas, "IDR", false)).toBe("2.00");
  });

  it("counts shared-item purchases and ignores the website-only action", () => {
    const age = aggregateDemographicRows("age", [
      {
        age: "25-34",
        impressions: "100",
        catalog_segment_actions: [
          { action_type: "offsite_conversion.fb_pixel_purchase", value: "9" },
          { action_type: "omni_purchase", value: "4" },
          { action_type: "omni_view_content", value: "20" },
          { action_type: "omni_add_to_cart", value: "6" },
        ],
        catalog_segment_value: [{ action_type: "omni_purchase", value: "80000" }],
      },
      {
        age: "25-34",
        catalog_segment_actions: [{ action_type: "omni_purchase", value: "1" }],
        catalog_segment_value: [{ action_type: "omni_purchase", value: "20000" }],
      },
    ]);
    const row = age.find((item) => item.key === "25-34");
    expect(row?.purchases).toBe(5);
    expect(row?.content_views).toBe(20);
    expect(row?.adds_to_cart).toBe(6);
    expect(row?.purchase_conversion_value).toBe(100000);
  });

  it("counts website and shop purchases by region when Omni is not broken down", () => {
    const region = aggregateDemographicRows("region", [
      {
        region: "Jakarta",
        impressions: "100",
        actions: [
          { action_type: "link_click", value: "9" },
          { action_type: "offsite_conversion.fb_pixel_purchase", value: "2" },
          { action_type: "onsite_conversion.purchase", value: "1" },
        ],
        action_values: [{ action_type: "offsite_conversion.fb_pixel_purchase", value: "150000" }],
      },
      {
        region: "Banten",
        actions: [
          { action_type: "omni_purchase", value: "4" },
          { action_type: "offsite_conversion.fb_pixel_purchase", value: "4" },
        ],
      },
    ]);
    expect(region.find((item) => item.key === "Jakarta")?.purchases).toBe(3);
    expect(region.find((item) => item.key === "Jakarta")?.purchase_conversion_value).toBe(150000);
    expect(region.find((item) => item.key === "Banten")?.purchases).toBe(4);
  });

  it("reads region purchases from the standard actions list when catalog segment is empty", () => {
    const region = aggregateDemographicRows(
      "region",
      withSharedItemActions([
        {
          region: "West Java",
          actions: [
            { action_type: "offsite_conversion.fb_pixel_purchase", value: "9" },
            { action_type: "omni_purchase", value: "4" },
          ],
          action_values: [{ action_type: "omni_purchase", value: "80000" }],
        },
      ]),
    );
    expect(region.find((item) => item.key === "West Java")?.purchases).toBe(4);
    expect(region.find((item) => item.key === "West Java")?.purchase_conversion_value).toBe(80000);
  });

  it("ignores the account-level Unknown purchase and keeps the named region", () => {
    const delivery = withoutCommerceFields([
      {
        region: "Unknown",
        impressions: "205",
        actions: [{ action_type: "offsite_conversion.fb_pixel_purchase", value: "1" }],
      },
      { region: "West Java", impressions: "89000" },
    ]);
    const region = aggregateDemographicRows("region", [
      ...delivery,
      ...withSharedItemActions([
        {
          region: "West Java",
          actions: [{ action_type: "offsite_conversion.fb_pixel_purchase", value: "6" }],
        },
      ]),
    ]);
    expect(region.find((item) => item.key === "West Java")?.purchases).toBe(6);
    expect(region.find((item) => item.key === "West Java")?.impressions).toBe(89000);
    expect(region.find((item) => item.key === "Unknown")?.purchases ?? 0).toBe(0);
  });

  it("keeps the Ads Manager age buckets and hides an empty 13-17 row", () => {
    const age = aggregateDemographicRows("age", [
      { age: "18-24", impressions: "27940", inline_link_clicks: "201" },
      { age: "25-34", impressions: "69560", inline_link_clicks: "872" },
      { age: "25-34", impressions: "10", inline_link_clicks: "1" },
      {
        age: "65+",
        impressions: "965",
        outbound_clicks: [{ action_type: "outbound_click", value: "12" }],
      },
    ]);
    expect(age.map((row) => row.key)).toEqual([
      "18-24",
      "25-34",
      "35-44",
      "45-54",
      "55-64",
      "65+",
    ]);
    expect(age[1]?.impressions).toBe(69570);
    expect(age[1]?.inline_link_clicks).toBe(873);
    expect(age[2]?.impressions).toBe(0);
    expect(age[5]?.outbound_clicks).toBe(12);
  });

  it("shows 13-17 and unknown only when Meta returned a value", () => {
    const age = aggregateDemographicRows("age", [
      { age: "13-17", impressions: "4" },
      { age: "Unknown", clicks: "2" },
    ]);
    expect(age.map((row) => row.key)[0]).toBe("13-17");
    expect(age.map((row) => row.key).at(-1)).toBe("unknown");
  });

  it("labels gender rows and drops an empty unknown bucket", () => {
    const gender = aggregateDemographicRows("gender", [
      { gender: "Female", impressions: "30310" },
      { gender: "male", impressions: "90720" },
    ]);
    expect(gender.map((row) => row.key)).toEqual(["female", "male"]);
    expect(gender[0]?.impressions).toBe(30310);
    expect(gender[1]?.impressions).toBe(90720);
  });

  it("keeps Meta region names and sorts them like Ads Manager", () => {
    const region = aggregateDemographicRows("region", [
      { region: "Bali", impressions: "10" },
      { region: "Aceh", impressions: "4" },
      { region: "unknown", impressions: "1" },
      { region: "West Java", impressions: "20" },
      { region: "Bangka–Belitung Islands", impressions: "3" },
      { region: "Bali", impressions: "2" },
    ]);
    expect(region.map((row) => row.key)).toEqual([
      "Aceh",
      "Bali",
      "Bangka–Belitung Islands",
      "Unknown",
      "West Java",
    ]);
    expect(region[1]?.impressions).toBe(12);
  });

  it("uses the most specific selected ids", () => {
    expect(readDemographicIds(["12", "abc", "12", " 34 "])).toEqual(["12", "34"]);
    expect(
      demographicInsightScope({ campaignIds: ["1"], adsetIds: ["2"], adIds: ["3"] }).level,
    ).toBe("ad");
    expect(demographicInsightScope({ campaignIds: ["1"], adsetIds: [], adIds: [] }).level).toBe(
      "campaign",
    );
    expect(demographicInsightScope({ campaignIds: [], adsetIds: [], adIds: [] }).level).toBe(
      "account",
    );
    expect(
      sharedItemInsightScope({ level: "account", field: null, ids: [] }).level,
    ).toBe("campaign");
    expect(
      sharedItemInsightScope({ level: "ad", field: "ad.id", ids: ["9"] }).level,
    ).toBe("ad");
  });

  it("compacts bar labels the way Ads Manager does", () => {
    expect(formatBreakdownCompact(69560)).toBe("69.56K");
    expect(formatBreakdownCompact(1210)).toBe("1.21K");
    expect(formatBreakdownCompact(762)).toBe("762");
    expect(formatBreakdownCompact(1000)).toBe("1K");
  });
});
