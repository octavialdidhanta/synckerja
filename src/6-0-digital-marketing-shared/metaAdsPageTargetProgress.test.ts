import { describe, expect, it } from "vitest";
import {
  computeMetaAdsPageTargetProgress,
  metaTargetProgressByTableMetric,
} from "@/6-0-digital-marketing-shared/metaAdsPageTargetProgress";
import type { DmReportTargetRow } from "@/6-0-digital-marketing-shared/dmReportTargetTypes";

function targetRow(
  partial: Partial<DmReportTargetRow> & Pick<DmReportTargetRow, "metric_key" | "period_type">,
): DmReportTargetRow {
  return {
    id: "1",
    organization_id: "org",
    channel: "meta",
    account_id: "act_1",
    year: 2026,
    month: null,
    quarter: null,
    target_value: 2,
    baseline_value: null,
    individual_objective_id: null,
    created_at: "",
    updated_at: "",
    ...partial,
  };
}

describe("computeMetaAdsPageTargetProgress", () => {
  it("shows the Q4 CTR bar while the Meta Ads filter is October", () => {
    const [progress] = computeMetaAdsPageTargetProgress({
      summary: { spend: 100, impressions: 10_000, clicks: 75, currency: "IDR" },
      rows: [],
      adAccountId: "act_1",
      dateSelection: {
        preset: "this_month",
        rollingDays: 30,
        range: { from: new Date(2026, 9, 1), to: new Date(2026, 9, 4) },
      },
      targetRows: [
        targetRow({
          metric_key: "ctr",
          period_type: "quarterly",
          quarter: 4,
          target_value: 2,
          baseline_value: 0.72,
        }),
      ],
      selectedTableMetricKeys: ["ctr"],
    });

    expect(progress?.showProgress).toBe(true);
    expect(progress?.actual).toBeCloseTo(0.75, 5);
    expect(progress?.target).toBe(2);
    expect(progress?.baseline).toBe(0.72);
    expect(progress?.percentage).toBe(2);
  });

  it("shows CPM, funnel rates, and AOV bars for a monthly filter against a quarterly target", () => {
    const list = computeMetaAdsPageTargetProgress({
      summary: {
        spend: 50_000,
        impressions: 10_000,
        clicks: 100,
        currency: "IDR",
        content_views: 200,
        adds_to_cart: 20,
        purchases: 5,
        purchase_conversion_value: 1_000_000,
        view_to_atc_rate: 10,
        atc_to_purchase_rate: 25,
        aov: 200_000,
      },
      rows: [],
      adAccountId: "act_1",
      dateSelection: {
        preset: "this_month",
        rollingDays: 30,
        range: { from: new Date(2026, 9, 1), to: new Date(2026, 9, 4) },
      },
      targetRows: [
        targetRow({
          metric_key: "cpm",
          period_type: "quarterly",
          quarter: 4,
          target_value: 8000,
          baseline_value: 6000,
        }),
        targetRow({
          metric_key: "view_to_atc_rate",
          period_type: "monthly",
          month: 10,
          target_value: 20,
          baseline_value: 8,
        }),
        targetRow({
          metric_key: "atc_to_purchase_rate",
          period_type: "quarterly",
          quarter: 4,
          target_value: 40,
        }),
        targetRow({
          metric_key: "aov",
          period_type: "quarterly",
          quarter: 4,
          target_value: 250_000,
        }),
      ],
      selectedTableMetricKeys: ["cpm", "view_to_atc_rate", "atc_to_purchase_rate", "aov"],
    });
    const byCard = metaTargetProgressByTableMetric(list, [
      "cpm",
      "view_to_atc_rate",
      "atc_to_purchase_rate",
      "aov",
    ]);

    expect(byCard.get("cpm")?.showProgress).toBe(true);
    expect(byCard.get("cpm")?.actual).toBe(5000);
    expect(byCard.get("cpm")?.target).toBe(8000);
    expect(byCard.get("view_to_atc_rate")?.showProgress).toBe(true);
    expect(byCard.get("view_to_atc_rate")?.actual).toBe(10);
    expect(byCard.get("view_to_atc_rate")?.baseline).toBe(8);
    expect(byCard.get("atc_to_purchase_rate")?.actual).toBe(25);
    expect(byCard.get("aov")?.actual).toBe(200_000);
  });
});
