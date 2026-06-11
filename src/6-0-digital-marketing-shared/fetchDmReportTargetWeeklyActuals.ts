import { endOfDay, startOfDay } from "date-fns";
import { toYmdLocal } from "@/6-0-google-ads/lib/googleAdsDatePresets";
import {
  actualValueFromGoogleTotals,
  actualValueFromMetaTikTok,
} from "@/6-0-digital-marketing-shared/dmReportTargetActuals";
import { googleApiKeysForReportMetrics } from "@/6-0-digital-marketing-shared/dmReportTargetMetricMapping";
import { resolvePeriodKeyToBounds } from "@/6-0-digital-marketing-shared/dmReportTargetPeriod";
import type {
  DmReportTargetPeriodKey,
  DmReportTargetRow,
} from "@/6-0-digital-marketing-shared/dmReportTargetTypes";
import type { ReportTableMetricKey } from "@/6-0-digital-marketing-shared/reportSummaryMetrics";
import { fetchGoogleAdsMetrics } from "@/google-ads/hooks/useGoogleAdsMetricsQuery";
import { fetchMetaAdsMetrics } from "@/meta-ads/hooks/useMetaAdsMetricsQuery";
import { fetchTikTokAdsMetrics } from "@/tiktok-ads/hooks/useTikTokAdsMetricsQuery";

export type DmWeeklyPeriodInput = {
  weekStart: Date;
  weekEnd: Date;
  weekKey: string;
  isFuture: boolean;
};

export function dmTargetRowToPeriodKey(row: DmReportTargetRow): DmReportTargetPeriodKey {
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

export async function fetchDmWeeklyCumulativeActuals(args: {
  organizationId: string;
  targetRow: DmReportTargetRow;
  weeks: DmWeeklyPeriodInput[];
  now?: Date;
}): Promise<Map<string, number | null>> {
  const now = args.now ?? new Date();
  const periodKey = dmTargetRowToPeriodKey(args.targetRow);
  const bounds = resolvePeriodKeyToBounds(periodKey, now);
  const result = new Map<string, number | null>();
  const metricKey = args.targetRow.metric_key as ReportTableMetricKey;

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
      if (args.targetRow.channel === "google") {
        const apiMetrics = googleApiKeysForReportMetrics([metricKey]);
        const response = await fetchGoogleAdsMetrics(args.organizationId, {
          customerId: args.targetRow.account_id,
          entity: "campaign",
          metrics: apiMetrics,
          dateRange: { start: range.dateStart, end: range.dateEnd },
          onlyRunning: false,
          statusFilter: "all",
          pageToken: "",
          pageSize: 1,
          sort: { field: "spent", direction: "desc" },
          summaryMetrics: apiMetrics,
        });
        result.set(
          week.weekKey,
          actualValueFromGoogleTotals(response.summary_totals ?? null, metricKey),
        );
      } else {
        const fetchFn =
          args.targetRow.channel === "meta" ? fetchMetaAdsMetrics : fetchTikTokAdsMetrics;
        const idKey = args.targetRow.channel === "meta" ? "adAccountId" : "advertiserId";
        const response = await fetchFn({
          organizationId: args.organizationId,
          [idKey]: args.targetRow.account_id,
          entity: "campaign",
          dateStart: range.dateStart,
          dateEnd: range.dateEnd,
        } as Parameters<typeof fetchMetaAdsMetrics>[0]);
        const needsRows = metricKey === "converted_leads" || metricKey === "cpa";
        result.set(
          week.weekKey,
          actualValueFromMetaTikTok(
            response.summary,
            needsRows ? response.rows : [],
            metricKey,
          ),
        );
      }
    } catch {
      result.set(week.weekKey, null);
    }
  }

  return result;
}
