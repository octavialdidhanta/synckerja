import { describe, expect, it } from "vitest";
import type { MetaAdsAccountSummary, MetaAdsMetricsRow } from "@/meta-ads/hooks/useMetaAdsMetricsQuery";
import {
  buildMetaAdsFunnelSummary,
  metaAdsFunnelSteps,
  readMetaAdsFunnelMetric,
  readMetaAdsPurchaseRoas,
  resolveMetaAdsFunnelLevel,
} from "@/meta-ads/metrics/metaAdsFunnel";

const account: MetaAdsAccountSummary = {
  spend: 1000,
  impressions: 5000,
  clicks: 100,
  reach: 4000,
  currency: "IDR",
  adds_to_cart: 20,
  purchases: 4,
};

const ads: MetaAdsMetricsRow[] = [
  { ad_id: "a1", impressions: "1000", clicks: "40", adds_to_cart: "8", purchases: "2", spend: "100" },
  { ad_id: "a2", impressions: "200", clicks: "10", adds_to_cart: "1", purchases: "0", spend: "20" },
  { ad_id: "a3", impressions: "50", clicks: "1", adds_to_cart: "0", purchases: "0", spend: "5" },
];

describe("metaAdsFunnel", () => {
  it("uses the deepest checked level", () => {
    expect(
      resolveMetaAdsFunnelLevel({ campaignIds: ["c1"], adsetIds: ["s1"], adIds: ["a1"] }),
    ).toBe("ad");
    expect(resolveMetaAdsFunnelLevel({ campaignIds: ["c1"], adsetIds: ["s1"], adIds: [] })).toBe(
      "adset",
    );
    expect(resolveMetaAdsFunnelLevel({ campaignIds: ["c1"], adsetIds: [], adIds: [] })).toBe(
      "campaign",
    );
    expect(resolveMetaAdsFunnelLevel({ campaignIds: [], adsetIds: [], adIds: [] })).toBe("campaign");
  });

  it("sums only the checked ads and keeps the account summary when nothing is checked", () => {
    const filtered = buildMetaAdsFunnelSummary({
      rows: ads,
      accountSummary: account,
      campaignIds: ["c1"],
      adsetIds: ["s1"],
      adIds: ["a1", "a2"],
    });
    expect(filtered?.impressions).toBe(1200);
    expect(filtered?.clicks).toBe(50);
    expect(filtered?.purchases).toBe(2);

    const withValue = buildMetaAdsFunnelSummary({
      rows: [
        { ad_id: "a1", spend: "100", purchase_conversion_value: "400", purchases: "2" },
        { ad_id: "a2", spend: "50", purchase_conversion_value: "50", purchases: "1" },
      ],
      accountSummary: account,
      campaignIds: [],
      adsetIds: [],
      adIds: ["a1", "a2"],
    });
    expect(withValue?.purchase_roas).toBeCloseTo(3, 5);
    expect(readMetaAdsPurchaseRoas(withValue)).toBeCloseTo(3, 5);
    expect(readMetaAdsPurchaseRoas({ ...account, purchase_roas: 4.2 })).toBe(4.2);

    const all = buildMetaAdsFunnelSummary({
      rows: ads,
      accountSummary: account,
      campaignIds: [],
      adsetIds: [],
      adIds: [],
    });
    expect(all).toBe(account);
  });

  it("derives link-click rate from impressions and sizes each bar from the previous stage", () => {
    expect(readMetaAdsFunnelMetric(account, "ctr")).toBe(2);
    expect(readMetaAdsFunnelMetric(account, "purchases")).toBe(4);
    const steps = metaAdsFunnelSteps(
      [1_238_149, 9_247, 6_209, 763],
      [true, true, true, true],
    );
    expect(steps[0]).toEqual({ height: 100, rate: null, belowPrevious: null });
    expect(steps[1]?.rate).toBeCloseTo((9247 / 1_238_149) * 100, 5);
    expect(steps[2]?.height).toBeLessThan(steps[1]?.height ?? 0);
    expect(steps[2]?.belowPrevious).toBe(9247 - 6209);
    expect(steps[3]?.height).toBeLessThan(steps[2]?.height ?? 0);
    expect(steps[3]?.rate).toBeCloseTo((763 / 1_238_149) * 100, 5);

    const reordered = metaAdsFunnelSteps(
      [9_247, 6_209, 763, 1_238_149],
      [true, true, true, true],
    );
    expect(reordered[3]?.height).toBe(100);
    expect(reordered[3]?.rate).toBeNull();
    expect(reordered[0]?.height).toBeLessThan(8);
  });
});
