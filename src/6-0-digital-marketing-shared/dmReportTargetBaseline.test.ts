import { describe, expect, it } from "vitest";
import {
  computeDmReportBaselineGapPercentage,
  dmCtrBaselinePercent,
  dmMetricBaselineOnTargetScale,
  mergeDmReportTargetRows,
} from "@/6-0-digital-marketing-shared/dmReportTargetBaseline";
import { computeDmReportTargetProgress } from "@/6-0-digital-marketing-shared/dmReportTargetProgress";
import {
  previousDmReportTargetPeriod,
  quarterlyPeriodContainingMonth,
} from "@/6-0-digital-marketing-shared/dmReportTargetPeriod";
import type { DmReportTargetRow } from "@/6-0-digital-marketing-shared/dmReportTargetTypes";

function row(partial: Partial<DmReportTargetRow> & Pick<DmReportTargetRow, "channel" | "metric_key" | "period_type">): DmReportTargetRow {
  return {
    id: "1",
    organization_id: "org",
    account_id: "acc",
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

describe("mergeDmReportTargetRows", () => {
  it("keeps monthly rows and fills CTR from the quarter", () => {
    const monthly = [
      row({ channel: "meta", metric_key: "cost", period_type: "monthly", month: 10, target_value: 10 }),
    ];
    const quarterly = [
      row({ channel: "meta", metric_key: "ctr", period_type: "quarterly", quarter: 4, target_value: 2 }),
      row({ channel: "meta", metric_key: "cost", period_type: "quarterly", quarter: 4, target_value: 99 }),
    ];
    const merged = mergeDmReportTargetRows(monthly, quarterly);
    expect(merged.map((r) => `${r.metric_key}:${r.target_value}`)).toEqual(["cost:10", "ctr:2"]);
  });
});

describe("CTR before", () => {
  it("maps October to Q4 and Q4's previous period to Q3", () => {
    expect(quarterlyPeriodContainingMonth(2026, 10)).toEqual({
      periodType: "quarterly",
      year: 2026,
      quarter: 4,
    });
    expect(previousDmReportTargetPeriod({ periodType: "quarterly", year: 2026, quarter: 4 })).toEqual({
      periodType: "quarterly",
      year: 2026,
      quarter: 3,
    });
    expect(previousDmReportTargetPeriod({ periodType: "monthly", year: 2026, month: 1 })).toEqual({
      periodType: "monthly",
      year: 2025,
      month: 12,
    });
  });

  it("uses a saved before value for cost as well as CTR", () => {
    const baseline = dmMetricBaselineOnTargetScale({
      metricKey: "cost",
      rows: [
        row({
          channel: "meta",
          metric_key: "cost",
          period_type: "monthly",
          month: 10,
          baseline_value: 125000,
        }),
      ],
      previousActualsByPeriod: new Map(),
    });
    expect(baseline).toBe(125000);
  });

  it("scores a lower target the same way", () => {
    expect(computeDmReportBaselineGapPercentage(4000, 5000, 1000)).toBe(25);
  });

  it("shows a finished month cost against its before value", () => {
    const [progress] = computeDmReportTargetProgress({
      accountActuals: new Map([
        [
          "meta:meta-1",
          {
            channel: "meta",
            accountId: "meta-1",
            hasConnectedAccount: true,
            metrics: { cost: 4000 },
            currencyCode: "IDR",
          },
        ],
      ]),
      dateSelection: {
        preset: "last_month",
        rollingDays: 30,
        range: { from: new Date(2026, 8, 1), to: new Date(2026, 8, 30) },
      },
      targetRows: [
        row({
          channel: "meta",
          account_id: "meta-1",
          metric_key: "cost",
          period_type: "monthly",
          month: 9,
          target_value: 1000,
          baseline_value: 5000,
        }),
      ],
      selectedMetricKeys: ["cost"],
      valueKinds: { cost: "currency" },
    });
    expect(progress?.actual).toBe(4000);
    expect(progress?.target).toBe(1000);
    expect(progress?.baseline).toBe(5000);
    expect(progress?.percentage).toBe(25);
  });

  it("uses a saved CTR before value", () => {
    const baseline = dmCtrBaselinePercent({
      metricKey: "ctr",
      rows: [
        row({
          channel: "meta",
          metric_key: "ctr",
          period_type: "quarterly",
          quarter: 4,
          baseline_value: 0.72,
        }),
      ],
      previousActualsByPeriod: new Map(),
    });
    expect(baseline).toBe(0.72);
  });

  it("scores how far current moved from before toward target", () => {
    expect(computeDmReportBaselineGapPercentage(0.75, 0.72, 2)).toBe(2);
    expect(computeDmReportBaselineGapPercentage(2, 0.72, 2)).toBe(100);
  });

  it("shows October CTR against a Q4 target", () => {
    const [progress] = computeDmReportTargetProgress({
      accountActuals: new Map(),
      dateSelection: {
        preset: "this_month",
        rollingDays: 30,
        range: { from: new Date(2026, 9, 1), to: new Date(2026, 9, 4) },
      },
      targetRows: [
        row({
          channel: "meta",
          account_id: "meta-1",
          metric_key: "ctr",
          period_type: "quarterly",
          quarter: 4,
          target_value: 2,
          baseline_value: 0.72,
        }),
      ],
      selectedMetricKeys: ["ctr"],
      valueKinds: { ctr: "rate" },
      cardActualByMetric: { ctr: 0.0075 },
    });
    expect(progress?.showProgress).toBe(true);
    expect(progress?.actual).toBeCloseTo(0.75, 5);
    expect(progress?.target).toBe(2);
    expect(progress?.baseline).toBe(0.72);
    expect(progress?.percentage).toBe(2);
  });
});
