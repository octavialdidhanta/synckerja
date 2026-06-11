import { endOfDay, startOfDay } from "date-fns";
import { toYmdLocal } from "@/6-0-google-ads/lib/googleAdsDatePresets";
import { actualValueFromTotals } from "@/6-0-digital-marketing-shared/googleAdsReportTargetActuals";
import { resolvePeriodKeyToBounds } from "@/6-0-digital-marketing-shared/googleAdsReportTargetPeriod";
import type {
  GoogleAdsReportTargetPeriodKey,
  GoogleAdsReportTargetRow,
} from "@/6-0-digital-marketing-shared/googleAdsReportTargetTypes";
import { fetchGoogleAdsMetrics } from "@/google-ads/hooks/useGoogleAdsMetricsQuery";

export type GoogleAdsWeeklyPeriodInput = {
  weekStart: Date;
  weekEnd: Date;
  weekKey: string;
  isFuture: boolean;
};

export function googleAdsTargetRowToPeriodKey(
  row: GoogleAdsReportTargetRow,
): GoogleAdsReportTargetPeriodKey {
  if (row.period_type === "monthly" && row.month != null) {
    return { periodType: "monthly", year: row.year, month: row.month };
  }
  return {
    periodType: "quarterly",
    year: row.year,
    quarter: row.quarter ?? 1,
  };
}

function resolveCumulativeWeekRange(args: {
  periodStart: Date;
  periodEnd: Date;
  weekEnd: Date;
  isFuture: boolean;
  now?: Date;
}): { dateStart: string; dateEnd: string } | null {
  const now = args.now ?? new Date();
  if (args.isFuture) return null;

  const today = endOfDay(now);
  const effectiveEnd = startOfDay(
    new Date(Math.min(args.weekEnd.getTime(), today.getTime(), endOfDay(args.periodEnd).getTime())),
  );
  const periodStart = startOfDay(args.periodStart);

  if (effectiveEnd.getTime() < periodStart.getTime()) return null;

  return {
    dateStart: toYmdLocal(periodStart),
    dateEnd: toYmdLocal(effectiveEnd),
  };
}

export async function fetchGoogleAdsWeeklyCumulativeActuals(args: {
  organizationId: string;
  targetRow: GoogleAdsReportTargetRow;
  weeks: GoogleAdsWeeklyPeriodInput[];
  now?: Date;
}): Promise<Map<string, number | null>> {
  const now = args.now ?? new Date();
  const periodKey = googleAdsTargetRowToPeriodKey(args.targetRow);
  const bounds = resolvePeriodKeyToBounds(periodKey, now);
  const result = new Map<string, number | null>();

  for (const week of args.weeks) {
    const range = resolveCumulativeWeekRange({
      periodStart: bounds.periodStart,
      periodEnd: bounds.periodEnd,
      weekEnd: week.weekEnd,
      isFuture: week.isFuture,
      now,
    });

    if (!range) {
      result.set(week.weekKey, null);
      continue;
    }

    try {
      const response = await fetchGoogleAdsMetrics(args.organizationId, {
        customerId: args.targetRow.google_customer_id,
        entity: "campaign",
        metrics: [args.targetRow.metric_key],
        dateRange: { start: range.dateStart, end: range.dateEnd },
        onlyRunning: false,
        statusFilter: "all",
        pageToken: "",
        pageSize: 1,
        sort: { field: "spent", direction: "desc" },
        summaryMetrics: [args.targetRow.metric_key],
      });
      const actual = actualValueFromTotals(
        response.summary_totals ?? null,
        args.targetRow.metric_key,
      );
      result.set(week.weekKey, actual);
    } catch {
      result.set(week.weekKey, null);
    }
  }

  return result;
}
