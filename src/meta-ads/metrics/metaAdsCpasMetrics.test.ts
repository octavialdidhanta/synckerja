import { describe, expect, it } from "vitest";
import {
  applyCpasMetrics,
  deliveryLabel,
  deriveCpasFields,
  pickBudget,
  readCpasCounts,
} from "../../../supabase/functions/_shared/metaAdsCpasMetrics.ts";

describe("metaAdsCpasMetrics", () => {
  it("reproduces the September CPAS ratios from shared-item counts", () => {
    const fields = deriveCpasFields({
      counts: {
        contentViews: 28506,
        addsToCart: 4035,
        purchases: 500,
        atcConversionValue: 0,
        purchaseConversionValue: 109_440_992,
      },
      spend: 5_314_762,
      linkClicks: 5091,
      impressions: 706_236,
      reach: 382_120,
      frequency: null,
    });

    expect(fields.click_to_view_rate).toBeCloseTo(559.93, 2);
    expect(fields.view_to_atc_rate).toBeCloseTo(14.15, 2);
    expect(fields.atc_to_purchase_rate).toBeCloseTo(12.39, 2);
    expect(fields.aov).toBeCloseTo(218_881.984, 2);
    expect(fields.purchase_roas).toBeCloseTo(20.59, 2);
    expect(fields.cost_per_purchase).toBeCloseTo(10_629.524, 2);
    expect(fields.frequency).toBeCloseTo(706_236 / 382_120, 5);
  });

  it("leaves a ratio empty when its divisor is zero", () => {
    const fields = deriveCpasFields({
      counts: {
        contentViews: 0,
        addsToCart: 0,
        purchases: 0,
        atcConversionValue: 0,
        purchaseConversionValue: 0,
      },
      spend: 1000,
      linkClicks: 0,
      impressions: 0,
      reach: 0,
      frequency: null,
    });

    expect(fields.click_to_view_rate).toBeNull();
    expect(fields.view_to_atc_rate).toBeNull();
    expect(fields.atc_to_purchase_rate).toBeNull();
    expect(fields.cost_per_atc).toBeNull();
    expect(fields.cost_per_purchase).toBeNull();
    expect(fields.aov).toBeNull();
    expect(fields.purchase_roas).toBe(0);
    expect(fields.frequency).toBeNull();

    const noSpend = deriveCpasFields({
      counts: {
        contentViews: 0,
        addsToCart: 0,
        purchases: 0,
        atcConversionValue: 0,
        purchaseConversionValue: 0,
      },
      spend: 0,
      linkClicks: 0,
      impressions: 0,
      reach: 0,
      frequency: null,
    });
    expect(noSpend.purchase_roas).toBeNull();
  });

  it("uses omni shared-item actions and ignores the website-only rows", () => {
    const counts = readCpasCounts({
      catalog_segment_actions: [
        { action_type: "offsite_conversion.fb_pixel_view_content", value: "10" },
        { action_type: "omni_view_content", value: "8178" },
        { action_type: "view_content", value: "100" },
        { action_type: "omni_add_to_cart", value: "1032" },
        { action_type: "omni_purchase", value: "80" },
      ],
      catalog_segment_value: [
        { action_type: "omni_add_to_cart", value: "250000" },
        { action_type: "offsite_conversion.fb_pixel_purchase", value: "1" },
        { action_type: "omni_purchase", value: "18000000" },
      ],
    });

    expect(counts).toEqual({
      contentViews: 8178,
      addsToCart: 1032,
      purchases: 80,
      atcConversionValue: 250000,
      purchaseConversionValue: 18000000,
    });
  });

  it("keeps Meta frequency on a single row and recomputes it when asked", () => {
    const row: Record<string, unknown> = {
      spend: "1000",
      impressions: "2000",
      clicks: "10",
      reach: "1000",
      frequency: "1.85",
      catalog_segment_actions: [{ action_type: "omni_view_content", value: "20" }],
      catalog_segment_value: [],
    };

    applyCpasMetrics(row);
    expect(row.frequency).toBe(1.85);
    expect(row.click_to_view_rate).toBeCloseTo(200, 5);
    expect(row.catalog_segment_actions).toBeUndefined();

    applyCpasMetrics(row, { recomputeFrequency: true });
    expect(row.frequency).toBeCloseTo(2, 5);
    expect(row.content_views).toBe(20);
  });

  it("reads IDR budgets as rupiah and maps delivery to Active or Off", () => {
    expect(pickBudget("150000", "0", "IDR")).toBe(150000);
    expect(pickBudget("0", "500000", "IDR")).toBe(500000);
    expect(pickBudget("5000", undefined, "USD")).toBe(50);
    expect(pickBudget("0", "0", "IDR")).toBeNull();
    expect(deliveryLabel("ACTIVE")).toBe("Active");
    expect(deliveryLabel("PAUSED")).toBe("Off");
    expect(deliveryLabel("CAMPAIGN_PAUSED")).toBe("Off");
    expect(deliveryLabel("")).toBeNull();
    expect(deliveryLabel("ACTIVE", "LEARNING")).toBe("Learning");
    expect(deliveryLabel("ACTIVE", "FAIL")).toBe("Learning limited");
    expect(deliveryLabel("ACTIVE", "SUCCESS")).toBe("Active");
  });
});
