import { describe, expect, it } from "vitest";
import type { MetaAdsMetricsRow } from "@/meta-ads/hooks/useMetaAdsMetricsQuery";
import {
  filterMetaAdsRowsByParent,
  metaAdsActiveAdsetOptions,
  metaAdsAdsetOptions,
  metaAdsCampaignOptions,
  applyParentReach,
  summarizeMetaAdsFilteredRows,
  summaryFromMetaAdsRow,
} from "@/meta-ads/metrics/metaAdsParentFilters";

const adsets: MetaAdsMetricsRow[] = [
  {
    campaign_id: "c1",
    campaign_name: "Broad",
    adset_id: "s1",
    adset_name: "Loop",
    delivery: "Active",
    spend: "10",
    impressions: "100",
    clicks: "2",
  },
  {
    campaign_id: "c1",
    campaign_name: "Broad",
    adset_id: "s2",
    adset_name: "Paused",
    delivery: "Off",
    spend: "5",
  },
  {
    campaign_id: "c1",
    campaign_name: "Broad",
    adset_id: "s4",
    adset_name: "Learning set",
    delivery: "Learning",
    spend: "8",
  },
  {
    campaign_id: "c2",
    campaign_name: "Retargeting",
    adset_id: "s3",
    adset_name: "Warm",
    delivery: "Active",
    spend: "20",
  },
];

const ads: MetaAdsMetricsRow[] = [
  { campaign_id: "c1", adset_id: "s1", ad_id: "a1", spend: "10", impressions: "100", clicks: "4" },
  { campaign_id: "c1", adset_id: "s2", ad_id: "a2", spend: "5", impressions: "40", clicks: "1" },
  { campaign_id: "c2", adset_id: "s3", ad_id: "a3", spend: "20", impressions: "80", clicks: "2" },
];

describe("metaAdsParentFilters", () => {
  it("lists campaigns from ad sets and keeps only active ad sets of the chosen campaign", () => {
    expect(metaAdsCampaignOptions(adsets).map((option) => option.name)).toEqual([
      "Broad",
      "Retargeting",
    ]);
    expect(metaAdsActiveAdsetOptions(adsets, "c1")).toEqual([
      { id: "s4", name: "Learning set" },
      { id: "s1", name: "Loop" },
    ]);
    expect(metaAdsActiveAdsetOptions(adsets, null)).toEqual([]);
    expect(metaAdsAdsetOptions(adsets, ["c1"]).map((option) => option.id)).toEqual([
      "s4",
      "s1",
      "s2",
    ]);
    expect(metaAdsAdsetOptions(adsets, [])).toEqual([]);
  });

  it("filters child rows from the checked campaigns and ad sets, including Off", () => {
    expect(
      filterMetaAdsRowsByParent({
        entity: "adset",
        rows: adsets,
        campaignIds: ["c1"],
        adsetIds: [],
      }).map((row) => row.adset_id),
    ).toEqual(["s1", "s2", "s4"]);

    expect(
      filterMetaAdsRowsByParent({
        entity: "adset",
        rows: adsets,
        campaignIds: ["c1", "c2"],
        adsetIds: [],
      }).map((row) => row.adset_id),
    ).toEqual(["s1", "s2", "s4", "s3"]);

    expect(
      filterMetaAdsRowsByParent({
        entity: "ad",
        rows: ads,
        campaignIds: ["c1"],
        adsetIds: [],
      }).map((row) => row.ad_id),
    ).toEqual(["a1", "a2"]);

    expect(
      filterMetaAdsRowsByParent({
        entity: "ad",
        rows: ads,
        campaignIds: ["c1", "c2"],
        adsetIds: ["s1"],
      }).map((row) => row.ad_id),
    ).toEqual(["a1"]);

    expect(
      filterMetaAdsRowsByParent({
        entity: "ad",
        rows: ads,
        campaignIds: [],
        adsetIds: ["s1", "s3"],
      }).map((row) => row.ad_id),
    ).toEqual(["a1", "a3"]);

    expect(
      filterMetaAdsRowsByParent({
        entity: "ad",
        rows: ads,
        campaignIds: [],
        adsetIds: [],
      }),
    ).toBe(ads);
  });

  it("sums the filtered rows into card totals", () => {
    const summary = summarizeMetaAdsFilteredRows([ads[0]], "IDR");
    expect(summary.spend).toBe(10);
    expect(summary.impressions).toBe(100);
    expect(summary.clicks).toBe(4);
    expect(summary.currency).toBe("IDR");
  });

  it("keeps the campaign row reach instead of summing ad sets", () => {
    const summary = summaryFromMetaAdsRow(
      {
        campaign_id: "c1",
        spend: "111420",
        impressions: "7681",
        clicks: "97",
        reach: "5160",
        frequency: "1.488566",
      },
      "IDR",
    );
    expect(summary.reach).toBe(5160);
    expect(summary.frequency).toBeCloseTo(1.488566, 5);
    expect(summary.spend).toBe(111420);
  });

  it("uses the ad set reach on summed ad rows", () => {
    const summed = summarizeMetaAdsFilteredRows(
      [
        { spend: "10", impressions: "100", clicks: "4", reach: "80" },
        { spend: "5", impressions: "40", clicks: "1", reach: "30" },
      ],
      "IDR",
    );
    const summary = applyParentReach(summed, { reach: "90", frequency: "1.55" });
    expect(summary.spend).toBe(15);
    expect(summary.impressions).toBe(140);
    expect(summary.reach).toBe(90);
    expect(summary.frequency).toBeCloseTo(1.55, 5);
  });
});
