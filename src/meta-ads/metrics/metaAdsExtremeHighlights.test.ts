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
  const bounds = metaAdsExtremeBounds([
    { ctr: 0.71, cpm: 6394 },
    { ctr: 0.67, cpm: 9706 },
    { ctr: 0.47, cpm: 10140 },
    { ctr: 0.17, cpm: 11445 },
    { ctr: 2.01, cpm: 10638 },
    { ctr: 1.04, cpm: 14871 },
    { ctr: 1.65, cpm: 19948 },
    { ctr: 1.99, cpm: 12825 },
  ]);

  it("uses solid green and red with white text on the extremes", () => {
    const bestCtr = metaAdsExtremeCellStyle("ctr", 2.01, bounds);
    const worstCtr = metaAdsExtremeCellStyle("ctr", 0.17, bounds);
    expect(bestCtr).toEqual({ backgroundColor: "rgb(22, 163, 74)", color: "#ffffff" });
    expect(worstCtr).toEqual({ backgroundColor: "rgb(220, 38, 38)", color: "#ffffff" });
    expect(metaAdsExtremeCellStyle("cpm", 6394, bounds)?.backgroundColor).toBe("rgb(22, 163, 74)");
    expect(metaAdsExtremeCellStyle("cpm", 19948, bounds)?.backgroundColor).toBe("rgb(220, 38, 38)");
  });

  it("gives each CTR a different shade following the number", () => {
    const high = rgb(metaAdsExtremeCellStyle("ctr", 1.99, bounds));
    const midHigh = rgb(metaAdsExtremeCellStyle("ctr", 1.65, bounds));
    const low = rgb(metaAdsExtremeCellStyle("ctr", 0.71, bounds));
    const lower = rgb(metaAdsExtremeCellStyle("ctr", 0.47, bounds));
    const middle = rgb(metaAdsExtremeCellStyle("ctr", 1.04, bounds));
    expect(high[0]).toBeLessThan(midHigh[0]);
    expect(lower[1]).toBeLessThan(low[1]);
    expect(middle[0]).toBeGreaterThan(middle[1]);
    expect(middle[1]).toBeGreaterThan(lower[1]);
    expect(metaAdsExtremeCellStyle("ctr", null, bounds)).toBeNull();
  });

  it("gives each CPM a different shade, greener when cheaper", () => {
    const cheap = rgb(metaAdsExtremeCellStyle("cpm", 9706, bounds));
    const midCheap = rgb(metaAdsExtremeCellStyle("cpm", 11445, bounds));
    const expensive = rgb(metaAdsExtremeCellStyle("cpm", 14871, bounds));
    const middle = rgb(metaAdsExtremeCellStyle("cpm", 12825, bounds));
    expect(cheap[0]).toBeLessThan(midCheap[0]);
    expect(expensive[0]).toBeGreaterThan(200);
    expect(middle[1]).toBeGreaterThan(middle[0]);
    expect(middle[0]).toBeGreaterThan(midCheap[0]);
    expect(metaAdsExtremeCellStyle("cpm", "—", bounds)).toBeNull();
  });

  it("colors % View to ATC and ATC conversion value greener as they rise", () => {
    const funnel = metaAdsExtremeBounds([
      { view_to_atc_rate: 14.27, atc_conversion_value: 608_022_172 },
      { view_to_atc_rate: 13.68, atc_conversion_value: 182_661_122 },
      { view_to_atc_rate: 12.14, atc_conversion_value: 29_068_968 },
    ]);
    const highRate = rgb(metaAdsExtremeCellStyle("view_to_atc_rate", 14.27, funnel));
    const lowRate = rgb(metaAdsExtremeCellStyle("view_to_atc_rate", 12.14, funnel));
    const highValue = rgb(metaAdsExtremeCellStyle("atc_conversion_value", 608_022_172, funnel));
    const lowValue = rgb(metaAdsExtremeCellStyle("atc_conversion_value", 29_068_968, funnel));
    expect(highRate).toEqual([22, 163, 74]);
    expect(lowRate).toEqual([220, 38, 38]);
    expect(highValue).toEqual([22, 163, 74]);
    expect(lowValue).toEqual([220, 38, 38]);
    const midRate = rgb(metaAdsExtremeCellStyle("view_to_atc_rate", 13.68, funnel));
    const midValue = rgb(metaAdsExtremeCellStyle("atc_conversion_value", 182_661_122, funnel));
    expect(midRate[0]).toBeGreaterThan(highRate[0]);
    expect(midRate[0]).toBeLessThan(lowRate[0]);
    expect(midValue[0]).toBeGreaterThan(highValue[0]);
    expect(midValue[1]).toBeGreaterThan(lowValue[1]);
  });

  it("colors % ATC to Purchase and Cost/Purchase, and leaves value columns plain", () => {
    const sales = metaAdsExtremeBounds([
      {
        atc_to_purchase_rate: 14.4,
        purchase_conversion_value: 65_716_454,
        cost_per_purchase: 6351,
        aov: 360_019,
      },
      {
        atc_to_purchase_rate: 9.43,
        purchase_conversion_value: 22_444_321,
        cost_per_purchase: 18_606,
        aov: 205_911,
      },
      {
        atc_to_purchase_rate: 3.3,
        purchase_conversion_value: 1_041_075,
        cost_per_purchase: 108_815,
        aov: 161_555,
      },
    ]);
    expect(rgb(metaAdsExtremeCellStyle("atc_to_purchase_rate", 14.4, sales))).toEqual([22, 163, 74]);
    expect(rgb(metaAdsExtremeCellStyle("atc_to_purchase_rate", 3.3, sales))).toEqual([220, 38, 38]);
    expect(rgb(metaAdsExtremeCellStyle("cost_per_purchase", 6351, sales))).toEqual([22, 163, 74]);
    expect(rgb(metaAdsExtremeCellStyle("cost_per_purchase", 108_815, sales))).toEqual([220, 38, 38]);
    expect(metaAdsExtremeCellStyle("purchase_conversion_value", 65_716_454, sales)).toBeNull();
    expect(metaAdsExtremeCellStyle("aov", 360_019, sales)).toBeNull();
    const roas = metaAdsExtremeBounds([
      { purchase_roas: 4.2 },
      { purchase_roas: 1.5 },
      { purchase_roas: 0.4 },
    ]);
    expect(rgb(metaAdsExtremeCellStyle("purchase_roas", 4.2, roas))).toEqual([22, 163, 74]);
    expect(rgb(metaAdsExtremeCellStyle("purchase_roas", 0.4, roas))).toEqual([220, 38, 38]);
  });

  it("leaves a column uncolored when every number is the same", () => {
    const flat = metaAdsExtremeBounds([
      { ctr: 1, cpm: 10 },
      { ctr: 1, cpm: null },
    ]);
    expect(metaAdsExtremeCellStyle("ctr", 1, flat)).toBeNull();
  });
});
