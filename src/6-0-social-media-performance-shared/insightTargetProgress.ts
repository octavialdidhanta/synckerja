import {
  aggregateInsightBaseline,
  computeInsightBaselineGapPercentage,
} from "@/6-0-social-media-performance-shared/insightTargetBaseline";
import { computeProgressAgainstMonthlyTarget } from "@/6-1-dashboard/utils/performanceEmployeeMetrics";
import type { PlatformPeriodActuals } from "@/6-0-social-media-performance-shared/insightTargetPlatformActuals";
import {
  effectiveTargetForMetric,
  resolveInsightTargetPeriod,
  type ResolvedInsightTargetPeriod,
} from "@/6-0-social-media-performance-shared/insightTargetPeriod";
import type { GoogleAdsDateRangeSelection } from "@/6-0-google-ads/lib/googleAdsDatePresets";
import {
  INSIGHT_TARGET_METRICS,
  type InsightTargetMetric,
  type InsightTargetProgress,
  type SocialMediaInsightTargetRow,
} from "@/6-0-social-media-performance-shared/socialMediaInsightTargetTypes";
import type {
  SocialMediaInsightAccountRow,
  SocialMediaInsightSummary,
  SocialMediaPlatformFilter,
} from "@/6-0-social-media-performance-shared/socialMediaInsightTypes";

function targetMapFromRows(rows: SocialMediaInsightTargetRow[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) {
    const value = Number(row.target_value);
    if (!Number.isFinite(value) || value < 0) continue;
    const accountId = row.account_id?.trim() ?? "";
    if (accountId) {
      map.set(`${row.platform}:${accountId}:${row.metric}`, value);
    } else {
      map.set(`${row.platform}:${row.metric}`, value);
    }
  }
  return map;
}

function targetForAccount(
  targetMap: Map<string, number>,
  platform: string,
  accountId: string,
  metric: InsightTargetMetric,
): number {
  return (
    targetMap.get(`${platform}:${accountId}:${metric}`) ??
    targetMap.get(`${platform}:${metric}`) ??
    0
  );
}

function aggregateTargetForMetric(
  metric: InsightTargetMetric,
  targetMap: Map<string, number>,
  accounts: SocialMediaInsightAccountRow[],
): number {
  const connected = accounts.filter((a) => a.connected && !a.isPlatformPlaceholder);
  if (connected.length === 0) return 0;

  if (metric === "avg_engagement_rate") {
    let weightedSum = 0;
    let weightTotal = 0;
    for (const account of connected) {
      const target = targetForAccount(targetMap, account.platform, account.accountId, metric);
      if (target <= 0) continue;
      const weight = account.totalViews;
      if (weight <= 0) continue;
      weightedSum += target * weight;
      weightTotal += weight;
    }
    if (weightTotal <= 0) {
      const targets = connected
        .map((a) => targetForAccount(targetMap, a.platform, a.accountId, metric))
        .filter((t) => t > 0);
      if (targets.length === 0) return 0;
      return targets.reduce((s, t) => s + t, 0) / targets.length;
    }
    return weightedSum / weightTotal;
  }

  return connected.reduce((sum, account) => {
    return sum + targetForAccount(targetMap, account.platform, account.accountId, metric);
  }, 0);
}

function singlePlatformTarget(
  metric: InsightTargetMetric,
  platform: Exclude<SocialMediaPlatformFilter, "all">,
  targetMap: Map<string, number>,
  accounts: SocialMediaInsightAccountRow[],
): number {
  const connected = accounts.filter(
    (a) => a.platform === platform && a.connected && !a.isPlatformPlaceholder,
  );
  if (metric === "avg_engagement_rate") {
    return aggregateTargetForMetric(metric, targetMap, connected);
  }
  return connected.reduce(
    (sum, account) =>
      sum + targetForAccount(targetMap, account.platform, account.accountId, metric),
    0,
  );
}

function actualForMetric(
  metric: InsightTargetMetric,
  summary: SocialMediaInsightSummary,
): number | null {
  switch (metric) {
    case "audience":
      return summary.totalAudience;
    case "views":
      return summary.totalViews;
    case "likes":
      return summary.totalLikes;
    case "comments":
      return summary.totalComments;
    case "shares":
      return summary.totalShares;
    case "avg_engagement_rate":
      return summary.avgEngagementRate;
    default:
      return null;
  }
}

function emptyProgress(
  metric: InsightTargetMetric,
  actual: number | null,
  targetRaw: number,
  showProgress: boolean,
): InsightTargetProgress {
  const hasTarget = targetRaw > 0;
  return {
    metric,
    actual,
    target: hasTarget ? targetRaw : null,
    targetRaw: hasTarget ? targetRaw : null,
    baseline: null,
    percentage: null,
    showProgress: showProgress && hasTarget,
  };
}

function buildMetricProgress(
  metric: InsightTargetMetric,
  actual: number | null,
  targetRaw: number,
  baselineFull: number | null,
  period: ResolvedInsightTargetPeriod | null,
  showProgress: boolean,
  now: Date,
): InsightTargetProgress {
  if (!showProgress || targetRaw <= 0) {
    return emptyProgress(metric, actual, targetRaw, false);
  }

  if (actual == null) {
    return emptyProgress(metric, null, targetRaw, true);
  }

  const target = effectiveTargetForMetric(targetRaw, metric, period, now);
  const baseline =
    baselineFull != null ? effectiveTargetForMetric(baselineFull, metric, period, now) : null;
  const percentage =
    target > 0
      ? baseline != null
        ? computeInsightBaselineGapPercentage(actual, baseline, target)
        : computeProgressAgainstMonthlyTarget(actual, target)
      : null;

  return {
    metric,
    actual,
    target,
    targetRaw,
    baseline,
    percentage,
    showProgress: true,
  };
}

function formatCount(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return value.toLocaleString();
}

function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return `${value.toFixed(2)}%`;
}

/** `before → current / target` when a baseline exists, otherwise `current / target`. */
export function formatInsightTargetRatio(progress: InsightTargetProgress | undefined): string | null {
  if (!progress?.showProgress || progress.target == null || progress.target <= 0) return null;
  if (progress.actual == null) return null;
  const format = (value: number) =>
    progress.metric === "avg_engagement_rate" ? formatPercent(value) : formatCount(value);
  if (progress.baseline != null) {
    return `${format(progress.baseline)} → ${format(progress.actual)} / ${format(progress.target)}`;
  }
  return `${format(progress.actual)} / ${format(progress.target)}`;
}

export function computeInsightTargetProgress(args: {
  summary: SocialMediaInsightSummary;
  accounts: SocialMediaInsightAccountRow[];
  platformFilter: SocialMediaPlatformFilter;
  dateSelection: GoogleAdsDateRangeSelection;
  targetRows: SocialMediaInsightTargetRow[];
  previousActualsByAccount?: Record<string, PlatformPeriodActuals>;
  now?: Date;
}): InsightTargetProgress[] {
  const now = args.now ?? new Date();
  const period = resolveInsightTargetPeriod(args.dateSelection, now);
  const showProgress = period != null;
  const targetMap = targetMapFromRows(args.targetRows);
  const rowsByCell = new Map<string, SocialMediaInsightTargetRow>();
  for (const row of args.targetRows) {
    const accountId = row.account_id?.trim();
    if (!accountId) continue;
    rowsByCell.set(`${row.platform}:${accountId}:${row.metric}`, row);
  }
  const previousActualsByAccount = args.previousActualsByAccount ?? {};

  const filteredAccounts =
    args.platformFilter === "all"
      ? args.accounts
      : args.accounts.filter((a) => a.platform === args.platformFilter);

  return INSIGHT_TARGET_METRICS.map((metric) => {
    const targetRaw =
      args.platformFilter === "all"
        ? aggregateTargetForMetric(metric, targetMap, filteredAccounts)
        : singlePlatformTarget(metric, args.platformFilter, targetMap, filteredAccounts);

    const actual = actualForMetric(metric, args.summary);
    const baselineFull = aggregateInsightBaseline({
      metric,
      accounts: filteredAccounts,
      targetMap,
      rowsByCell,
      previousActualsByAccount,
    });
    return buildMetricProgress(metric, actual, targetRaw, baselineFull, period, showProgress, now);
  });
}

export function insightTargetProgressByMetric(
  progress: InsightTargetProgress[],
): Record<InsightTargetMetric, InsightTargetProgress> {
  return progress.reduce(
    (acc, item) => {
      acc[item.metric] = item;
      return acc;
    },
    {} as Record<InsightTargetMetric, InsightTargetProgress>,
  );
}
