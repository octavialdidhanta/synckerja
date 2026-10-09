import { describe, expect, it } from "vitest";
import {
  metaAdsExtremeBounds,
  metaAdsExtremeCellStyle,
} from "@/meta-ads/metrics/metaAdsExtremeHighlights";

function rgb(style: { backgroundColor: string } | null): [number, number, number] {
  const match = style?.backgroundColor.match(/rgb\((\d+), (\d+), (\d+)\)/);
  if (!match) throw new Error("missing background");
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

describe("metaAdsExtremeCellStyle", () => {
  it("colors CTR from a fixed percent, darker farther away", () => {
    const empty = metaAdsExtremeBounds([]);
    const options = { ctrThreshold: 1 };
    expect(rgb(metaAdsExtremeCellStyle("ctr", 0, empty, options))).toEqual([220, 38, 38]);
    expect(rgb(metaAdsExtremeCellStyle("ctr", 2, empty, options))).toEqual([22, 163, 74]);

    const below = rgb(metaAdsExtremeCellStyle("ctr", 0.4, empty, options));
    const nearCut = rgb(metaAdsExtremeCellStyle("ctr", 0.9, empty, options));
    const atCut = rgb(metaAdsExtremeCellStyle("ctr", 1, empty, options));
    const above = rgb(metaAdsExtremeCellStyle("ctr", 1.5, empty, options));

    expect(below[1]).toBeLessThan(nearCut[1]);
    expect(nearCut[0]).toBeGreaterThan(nearCut[1]);
    expect(atCut[1]).toBeGreaterThan(atCut[0]);
    expect(above[1]).toBeLessThan(atCut[1]);
    expect(metaAdsExtremeCellStyle("ctr", null, empty, options)).toBeNull();
    expect(
      metaAdsExtremeCellStyle("ctr", 0.4, empty, { ctrThreshold: 1, ctrColorEnabled: false }),
    ).toBeNull();
  });

  it("colors CPM from a fixed amount, greener when cheaper", () => {
    const empty = metaAdsExtremeBounds([]);
    const options = { cpmThreshold: 10000 };
    expect(rgb(metaAdsExtremeCellStyle("cpm", 0, empty, options))).toEqual([22, 163, 74]);
    expect(rgb(metaAdsExtremeCellStyle("cpm", 20000, empty, options))).toEqual([220, 38, 38]);

    const cheap = rgb(metaAdsExtremeCellStyle("cpm", 4000, empty, options));
    const nearCut = rgb(metaAdsExtremeCellStyle("cpm", 9000, empty, options));
    const atCut = rgb(metaAdsExtremeCellStyle("cpm", 10000, empty, options));
    const expensive = rgb(metaAdsExtremeCellStyle("cpm", 15000, empty, options));

    expect(cheap[1]).toBeLessThan(nearCut[1]);
    expect(atCut[1]).toBeGreaterThan(atCut[0]);
    expect(expensive[0]).toBeGreaterThan(expensive[1]);
    expect(metaAdsExtremeCellStyle("cpm", null, empty, options)).toBeNull();
    expect(
      metaAdsExtremeCellStyle("cpm", 15000, empty, { cpmThreshold: 10000, cpmColorEnabled: false }),
    ).toBeNull();
  });

  it("colors ATC conversion value greener as it rises", () => {
    const funnel = metaAdsExtremeBounds([
      { atc_conversion_value: 608_022_172 },
      { atc_conversion_value: 182_661_122 },
      { atc_conversion_value: 29_068_968 },
    ]);
    const highValue = rgb(metaAdsExtremeCellStyle("atc_conversion_value", 608_022_172, funnel));
    const lowValue = rgb(metaAdsExtremeCellStyle("atc_conversion_value", 29_068_968, funnel));
    expect(highValue).toEqual([22, 163, 74]);
    expect(lowValue).toEqual([220, 38, 38]);
    const midValue = rgb(metaAdsExtremeCellStyle("atc_conversion_value", 182_661_122, funnel));
    expect(midValue[0]).toBeGreaterThan(highValue[0]);
    expect(midValue[1]).toBeGreaterThan(lowValue[1]);
  });

  it("colors % View to ATC from a fixed percent, darker farther away", () => {
    const empty = metaAdsExtremeBounds([]);
    const options = { viewToAtcThreshold: 10 };
    expect(rgb(metaAdsExtremeCellStyle("view_to_atc_rate", 0, empty, options))).toEqual([
      220, 38, 38,
    ]);
    expect(rgb(metaAdsExtremeCellStyle("view_to_atc_rate", 20, empty, options))).toEqual([
      22, 163, 74,
    ]);

    const below = rgb(metaAdsExtremeCellStyle("view_to_atc_rate", 4, empty, options));
    const nearCut = rgb(metaAdsExtremeCellStyle("view_to_atc_rate", 9, empty, options));
    const atCut = rgb(metaAdsExtremeCellStyle("view_to_atc_rate", 10, empty, options));
    const above = rgb(metaAdsExtremeCellStyle("view_to_atc_rate", 15, empty, options));

    expect(below[1]).toBeLessThan(nearCut[1]);
    expect(nearCut[0]).toBeGreaterThan(nearCut[1]);
    expect(atCut[1]).toBeGreaterThan(atCut[0]);
    expect(above[1]).toBeLessThan(atCut[1]);
    expect(metaAdsExtremeCellStyle("view_to_atc_rate", null, empty, options)).toBeNull();
    expect(
      metaAdsExtremeCellStyle("view_to_atc_rate", 4, empty, {
        viewToAtcThreshold: 10,
        viewToAtcColorEnabled: false,
      }),
    ).toBeNull();
  });

  it("leaves purchase conversion value uncolored", () => {
    const sales = metaAdsExtremeBounds([
      { purchase_conversion_value: 65_716_454 },
      { purchase_conversion_value: 22_444_321 },
    ]);
    expect(metaAdsExtremeCellStyle("purchase_conversion_value", 65_716_454, sales)).toBeNull();
  });

  it("colors AOV from a fixed amount, darker farther away", () => {
    const empty = metaAdsExtremeBounds([]);
    const options = { aovThreshold: 150000 };
    expect(rgb(metaAdsExtremeCellStyle("aov", 0, empty, options))).toEqual([220, 38, 38]);
    expect(rgb(metaAdsExtremeCellStyle("aov", 300000, empty, options))).toEqual([22, 163, 74]);

    const below = rgb(metaAdsExtremeCellStyle("aov", 60000, empty, options));
    const nearCut = rgb(metaAdsExtremeCellStyle("aov", 140000, empty, options));
    const atCut = rgb(metaAdsExtremeCellStyle("aov", 150000, empty, options));
    const above = rgb(metaAdsExtremeCellStyle("aov", 220000, empty, options));

    expect(below[1]).toBeLessThan(nearCut[1]);
    expect(nearCut[0]).toBeGreaterThan(nearCut[1]);
    expect(atCut[1]).toBeGreaterThan(atCut[0]);
    expect(above[1]).toBeLessThan(atCut[1]);
    expect(metaAdsExtremeCellStyle("aov", null, empty, options)).toBeNull();
    expect(
      metaAdsExtremeCellStyle("aov", 60000, empty, {
        aovThreshold: 150000,
        aovColorEnabled: false,
      }),
    ).toBeNull();
  });

  it("colors % ATC to Purchase from a fixed percent, darker farther away", () => {
    const empty = metaAdsExtremeBounds([]);
    const options = { atcToPurchaseThreshold: 20 };
    expect(rgb(metaAdsExtremeCellStyle("atc_to_purchase_rate", 0, empty, options))).toEqual([
      220, 38, 38,
    ]);
    expect(rgb(metaAdsExtremeCellStyle("atc_to_purchase_rate", 40, empty, options))).toEqual([
      22, 163, 74,
    ]);

    const below = rgb(metaAdsExtremeCellStyle("atc_to_purchase_rate", 8, empty, options));
    const nearCut = rgb(metaAdsExtremeCellStyle("atc_to_purchase_rate", 18, empty, options));
    const atCut = rgb(metaAdsExtremeCellStyle("atc_to_purchase_rate", 20, empty, options));
    const above = rgb(metaAdsExtremeCellStyle("atc_to_purchase_rate", 30, empty, options));

    expect(below[1]).toBeLessThan(nearCut[1]);
    expect(nearCut[0]).toBeGreaterThan(nearCut[1]);
    expect(atCut[1]).toBeGreaterThan(atCut[0]);
    expect(above[1]).toBeLessThan(atCut[1]);
    expect(metaAdsExtremeCellStyle("atc_to_purchase_rate", null, empty, options)).toBeNull();
    expect(
      metaAdsExtremeCellStyle("atc_to_purchase_rate", 8, empty, {
        atcToPurchaseThreshold: 20,
        atcToPurchaseColorEnabled: false,
      }),
    ).toBeNull();
  });

  it("colors Purchase ROAS from a fixed threshold, darker farther away", () => {
    const empty = metaAdsExtremeBounds([]);
    const options = { purchaseRoasThreshold: 10 };
    expect(rgb(metaAdsExtremeCellStyle("purchase_roas", 0, empty, options))).toEqual([220, 38, 38]);
    expect(rgb(metaAdsExtremeCellStyle("purchase_roas", 20, empty, options))).toEqual([22, 163, 74]);

    const below = rgb(metaAdsExtremeCellStyle("purchase_roas", 4, empty, options));
    const nearCut = rgb(metaAdsExtremeCellStyle("purchase_roas", 9, empty, options));
    const atCut = rgb(metaAdsExtremeCellStyle("purchase_roas", 10, empty, options));
    const above = rgb(metaAdsExtremeCellStyle("purchase_roas", 15, empty, options));

    expect(below[1]).toBeLessThan(nearCut[1]);
    expect(nearCut[0]).toBeGreaterThan(nearCut[1]);
    expect(atCut[1]).toBeGreaterThan(atCut[0]);
    expect(above[1]).toBeLessThan(atCut[1]);
    expect(metaAdsExtremeCellStyle("purchase_roas", null, empty, options)).toBeNull();
  });

  it("colors Cost/Purchase from a fixed threshold, greener when cheaper", () => {
    const empty = metaAdsExtremeBounds([]);
    const options = { costPerPurchaseThreshold: 40000 };
    expect(rgb(metaAdsExtremeCellStyle("cost_per_purchase", 0, empty, options))).toEqual([
      22, 163, 74,
    ]);
    expect(rgb(metaAdsExtremeCellStyle("cost_per_purchase", 80000, empty, options))).toEqual([
      220, 38, 38,
    ]);

    const cheap = rgb(metaAdsExtremeCellStyle("cost_per_purchase", 10000, empty, options));
    const nearCut = rgb(metaAdsExtremeCellStyle("cost_per_purchase", 35000, empty, options));
    const atCut = rgb(metaAdsExtremeCellStyle("cost_per_purchase", 40000, empty, options));
    const expensive = rgb(metaAdsExtremeCellStyle("cost_per_purchase", 60000, empty, options));

    expect(cheap[1]).toBeLessThan(nearCut[1]);
    expect(atCut[1]).toBeGreaterThan(atCut[0]);
    expect(expensive[0]).toBeGreaterThan(expensive[1]);
    expect(metaAdsExtremeCellStyle("cost_per_purchase", null, empty, options)).toBeNull();
  });

  it("leaves a metric uncolored when its color switch is off", () => {
    const empty = metaAdsExtremeBounds([]);
    expect(
      metaAdsExtremeCellStyle("purchase_roas", 4, empty, {
        purchaseRoasThreshold: 10,
        purchaseRoasColorEnabled: false,
      }),
    ).toBeNull();
    expect(
      metaAdsExtremeCellStyle("cost_per_purchase", 80000, empty, {
        costPerPurchaseThreshold: 40000,
        costPerPurchaseColorEnabled: false,
      }),
    ).toBeNull();
    expect(
      metaAdsExtremeCellStyle("purchase_roas", 20, empty, {
        purchaseRoasThreshold: 10,
        purchaseRoasColorEnabled: true,
      })?.backgroundColor,
    ).toBe("rgb(22, 163, 74)");
  });

  it("leaves a column uncolored when every number is the same", () => {
    const flat = metaAdsExtremeBounds([
      { atc_conversion_value: 100 },
      { atc_conversion_value: 100 },
    ]);
    expect(metaAdsExtremeCellStyle("atc_conversion_value", 100, flat)).toBeNull();
  });
});
