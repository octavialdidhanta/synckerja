import { actualValueForMetric, type PlatformPeriodActuals } from "@/6-0-social-media-performance-shared/insightTargetPlatformActuals";
import type {
  InsightTargetMetric,
  SocialMediaInsightTargetRow,
} from "@/6-0-social-media-performance-shared/socialMediaInsightTargetTypes";
import type { SocialMediaInsightAccountRow } from "@/6-0-social-media-performance-shared/socialMediaInsightTypes";

export function savedInsightBaselineValue(
  row: Pick<SocialMediaInsightTargetRow, "baseline_value"> | undefined,
): number | null {
  if (!row || row.baseline_value == null) return null;
  const value = Number(row.baseline_value);
  return Number.isFinite(value) && value > 0 ? value : null;
}

/** Share of the before → target gap already covered by current. */
export function computeInsightBaselineGapPercentage(
  actual: number,
  baseline: number,
  target: number,
): number {
  const gap = target - baseline;
  if (!Number.isFinite(gap) || gap === 0) {
    return actual === target ? 100 : 0;
  }
  return Math.round(((actual - baseline) / gap) * 100);
}

export function insightAccountBaseline(args: {
  saved: number | null;
  previousActual: number | null;
}): number | null {
  if (args.saved != null) return args.saved;
  if (args.previousActual != null && Number.isFinite(args.previousActual) && args.previousActual > 0) {
    return args.previousActual;
  }
  return null;
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

/**
 * Baseline on the same scale as the aggregated target.
 * Only accounts that have a target contribute. Volume metrics are summed.
 * Engagement rate is weighted by the previous period's views.
 */
export function aggregateInsightBaseline(args: {
  metric: InsightTargetMetric;
  accounts: SocialMediaInsightAccountRow[];
  targetMap: Map<string, number>;
  rowsByCell: Map<string, SocialMediaInsightTargetRow>;
  previousActualsByAccount: Record<string, PlatformPeriodActuals>;
}): number | null {
  const connected = args.accounts.filter((account) => account.connected && !account.isPlatformPlaceholder);
  const entries: { value: number; views: number }[] = [];

  for (const account of connected) {
    if (targetForAccount(args.targetMap, account.platform, account.accountId, args.metric) <= 0) {
      continue;
    }
    const cellKey = `${account.platform}:${account.accountId}:${args.metric}`;
    const previous = args.previousActualsByAccount[`${account.platform}:${account.accountId}`];
    const baseline = insightAccountBaseline({
      saved: savedInsightBaselineValue(args.rowsByCell.get(cellKey)),
      previousActual: previous ? actualValueForMetric(previous, args.metric) : null,
    });
    if (baseline == null) continue;
    entries.push({ value: baseline, views: previous?.views ?? 0 });
  }

  if (entries.length === 0) return null;

  if (args.metric === "avg_engagement_rate") {
    let weighted = 0;
    let weight = 0;
    for (const entry of entries) {
      if (entry.views <= 0) continue;
      weighted += entry.value * entry.views;
      weight += entry.views;
    }
    if (weight > 0) return weighted / weight;
    return entries.reduce((sum, entry) => sum + entry.value, 0) / entries.length;
  }

  return entries.reduce((sum, entry) => sum + entry.value, 0);
}
