import { endOfDay, startOfDay } from "date-fns";
import { fetchInsightActualForAccountMetric } from "@/6-0-social-media-performance-shared/fetchInsightActualsForDateRange";
import {
  INSIGHT_FETCH_CONCURRENCY,
  mapWithConcurrency,
} from "@/6-0-social-media-performance-shared/fetchInsightAccountMetrics";
import { resolvePeriodKeyToBounds } from "@/6-0-social-media-performance-shared/insightTargetPeriod";
import type {
  InsightTargetPeriodKey,
  SocialMediaInsightTargetRow,
} from "@/6-0-social-media-performance-shared/socialMediaInsightTargetTypes";
import { toYmdLocal } from "@/6-0-google-ads/lib/googleAdsDatePresets";

export type InsightWeeklyPeriodInput = {
  weekStart: Date;
  weekEnd: Date;
  weekKey: string;
  isFuture: boolean;
};

export function targetRowToPeriodKey(row: SocialMediaInsightTargetRow): InsightTargetPeriodKey {
  if (row.period_type === "monthly" && row.month != null) {
    return { periodType: "monthly", year: row.year, month: row.month };
  }
  return {
    periodType: "quarterly",
    year: row.year,
    quarter: row.quarter ?? 1,
  };
}

/** Cumulative actual from period start through week end (clamped to today and period end). */
export function resolveCumulativeWeekRange(args: {
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

export async function fetchInsightWeeklyCumulativeActuals(args: {
  organizationId: string;
  targetRow: SocialMediaInsightTargetRow;
  accountLabel?: string;
  avatarUrl?: string | null;
  weeks: InsightWeeklyPeriodInput[];
  now?: Date;
}): Promise<Map<string, number | null>> {
  const now = args.now ?? new Date();
  const periodKey = targetRowToPeriodKey(args.targetRow);
  const bounds = resolvePeriodKeyToBounds(periodKey, now);
  const result = new Map<string, number | null>();

  const weekJobs = args.weeks.map((week) => {
    const range = resolveCumulativeWeekRange({
      periodStart: bounds.periodStart,
      periodEnd: bounds.periodEnd,
      weekEnd: week.weekEnd,
      isFuture: week.isFuture,
      now,
    });
    return { weekKey: week.weekKey, range };
  });

  const fetchJobs = weekJobs.filter((j): j is { weekKey: string; range: { dateStart: string; dateEnd: string } } =>
    j.range != null,
  );

  for (const job of weekJobs) {
    if (!job.range) {
      result.set(job.weekKey, null);
    }
  }

  const values = await mapWithConcurrency(fetchJobs, INSIGHT_FETCH_CONCURRENCY, async (job) => {
    const value = await fetchInsightActualForAccountMetric({
      organizationId: args.organizationId,
      platform: args.targetRow.platform,
      accountId: args.targetRow.account_id,
      accountLabel: args.accountLabel,
      avatarUrl: args.avatarUrl,
      metric: args.targetRow.metric,
      dateStart: job.range.dateStart,
      dateEnd: job.range.dateEnd,
    });
    return { weekKey: job.weekKey, value };
  });

  for (const { weekKey, value } of values) {
    result.set(weekKey, value);
  }

  return result;
}
