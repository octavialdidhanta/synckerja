import { describe, expect, it } from "vitest";
import {
  buildCombinedChartPeriodSummary,
  buildMonthlySpendChartPoints,
  sumReportMonthlySpendChartPoints,
  type MonthlySpendChannelSeries,
} from "@/6-0-digital-marketing-shared/hooks/useDigitalMarketingReportMonthlySpend";

const emptySeries = (): MonthlySpendChannelSeries => ({
  connected: true,
  loading: false,
  error: null,
  currency: "IDR",
  months: [],
  periodSummary: null,
});

const emptyTikTok = (): MonthlySpendChannelSeries => ({
  ...emptySeries(),
  connected: false,
  months: [],
});

describe("report monthly spend chart totals", () => {
  it("all_time bars sum equals combined period spend (Google + Meta)", () => {
    const google: MonthlySpendChannelSeries = {
      ...emptySeries(),
      months: [
        { year: 2024, month: 1, spend: 1_000_000, converted_leads: 0 },
        { year: 2025, month: 1, spend: 500_000, converted_leads: 0 },
        { year: 2024, month: 2, spend: 200_000, converted_leads: 0 },
      ],
      periodSummary: { spend: 1_700_000, converted_leads: 0, cpa: null },
    };
    const meta: MonthlySpendChannelSeries = {
      ...emptySeries(),
      months: [
        { year: 2024, month: 1, spend: 300_000, converted_leads: 1 },
        { year: 2024, month: 2, spend: 100_000, converted_leads: 0 },
      ],
      periodSummary: { spend: 400_000, converted_leads: 1, cpa: 400_000 },
    };
    const scope = { includeGoogle: true, includeMeta: true, includeTikTok: false };
    const tiktok = emptyTikTok();

    const points = buildMonthlySpendChartPoints({
      year: 2025,
      locale: "en-US",
      spanMode: "all_time",
      google,
      meta,
      tiktok,
      combinedScope: scope,
    });

    const barTotal = sumReportMonthlySpendChartPoints(points, "all");
    const periodTotal = buildCombinedChartPeriodSummary(google, meta, tiktok, scope, "all_time");

    expect(barTotal).toBe(2_100_000);
    expect(periodTotal.spend).toBe(2_100_000);
    expect(points.find((p) => p.month === 1)?.totalSpend).toBe(1_800_000);
    expect(points.find((p) => p.month === 2)?.totalSpend).toBe(300_000);
  });

  it("calendar_year bars sum equals per-channel period spend", () => {
    const google: MonthlySpendChannelSeries = {
      ...emptySeries(),
      months: [
        { year: 2025, month: 3, spend: 943_221, converted_leads: 0 },
        { year: 2025, month: 6, spend: 1_339_523, converted_leads: 0 },
      ],
      periodSummary: { spend: 2_282_744, converted_leads: 0, cpa: null },
    };
    const meta: MonthlySpendChannelSeries = {
      ...emptySeries(),
      months: [
        { year: 2025, month: 3, spend: 328_660, converted_leads: 0 },
      ],
      periodSummary: { spend: 328_660, converted_leads: 0, cpa: null },
    };
    const scope = { includeGoogle: true, includeMeta: true, includeTikTok: false };
    const tiktok = emptyTikTok();

    const points = buildMonthlySpendChartPoints({
      year: 2025,
      locale: "en-US",
      spanMode: "calendar_year",
      google,
      meta,
      tiktok,
      combinedScope: scope,
    });

    const barTotal = sumReportMonthlySpendChartPoints(points, "all");
    const periodTotal = buildCombinedChartPeriodSummary(google, meta, tiktok, scope, "calendar_year");

    expect(barTotal).toBe(2_611_404);
    expect(periodTotal.spend).toBe(2_611_404);
  });
});
