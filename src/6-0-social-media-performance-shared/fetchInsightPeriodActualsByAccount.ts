import {
  fetchInsightAccountMetrics,
  INSIGHT_FETCH_CONCURRENCY,
  mapWithConcurrency,
} from "@/6-0-social-media-performance-shared/fetchInsightAccountMetrics";
import {
  actualsFromAccountRow,
  type PlatformPeriodActuals,
} from "@/6-0-social-media-performance-shared/insightTargetPlatformActuals";
import {
  periodKeyToDateRangePayload,
  resolvePeriodKeyToBounds,
} from "@/6-0-social-media-performance-shared/insightTargetPeriod";
import type {
  InsightTargetAccountRef,
  InsightTargetPeriodKey,
} from "@/6-0-social-media-performance-shared/socialMediaInsightTargetTypes";
import { clampTikTokAdsDateRange } from "@/tiktok-ads/lib/clampTikTokAdsDateRange";
import { startOfDay } from "date-fns";

export async function fetchInsightPeriodActualsByAccount(args: {
  organizationId: string;
  period: InsightTargetPeriodKey;
  accounts: InsightTargetAccountRef[];
  now?: Date;
}): Promise<Map<string, PlatformPeriodActuals>> {
  const now = args.now ?? new Date();
  const bounds = resolvePeriodKeyToBounds(args.period, now);
  const periodNotStarted = startOfDay(bounds.periodStart).getTime() > startOfDay(now).getTime();
  const map = new Map<string, PlatformPeriodActuals>();

  if (periodNotStarted || args.accounts.length === 0) return map;

  const dateRange = periodKeyToDateRangePayload(args.period, now);
  const clamped = clampTikTokAdsDateRange(dateRange.start, dateRange.end, now);

  const accountRows = await mapWithConcurrency(args.accounts, INSIGHT_FETCH_CONCURRENCY, (account) =>
    fetchInsightAccountMetrics(args.organizationId, account, clamped.start, clamped.end),
  );

  for (const row of accountRows) {
    map.set(`${row.platform}:${row.accountId}`, actualsFromAccountRow(row));
  }

  return map;
}
