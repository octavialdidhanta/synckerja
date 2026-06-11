import {
  insightTargetCellKey,
  type InsightTargetAccountRef,
  type InsightTargetMetric,
  type InsightTargetPlatform,
} from "@/6-0-social-media-performance-shared/socialMediaInsightTargetTypes";
import type { SocialMediaInsightAccountRow } from "@/6-0-social-media-performance-shared/socialMediaInsightTypes";

export type PlatformPeriodActuals = {
  audience: number | null;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  avgEngagementRate: number | null;
  hasConnectedAccount: boolean;
};

function summarizePlatformAccounts(
  accounts: SocialMediaInsightAccountRow[],
): PlatformPeriodActuals {
  return summarizeAccountsActuals(
    accounts
      .filter((a) => a.connected && !a.isPlatformPlaceholder && !a.error)
      .map((a) => actualsFromAccountRow(a)),
  );
}

/** Same rollup rules as the Insight Report summary (views-weighted avg. engagement). */
export function summarizeAccountsActuals(
  accounts: PlatformPeriodActuals[],
): PlatformPeriodActuals {
  const connected = accounts.filter((a) => a.hasConnectedAccount);
  if (connected.length === 0) {
    return {
      audience: null,
      views: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      avgEngagementRate: null,
      hasConnectedAccount: false,
    };
  }

  let audienceSum = 0;
  let hasAudience = false;
  for (const a of connected) {
    if (a.audience != null) {
      audienceSum += a.audience;
      hasAudience = true;
    }
  }

  let engagementWeighted = 0;
  let engagementWeight = 0;
  for (const a of connected) {
    if (a.avgEngagementRate != null && a.views > 0) {
      engagementWeighted += a.avgEngagementRate * a.views;
      engagementWeight += a.views;
    }
  }

  return {
    audience: hasAudience ? audienceSum : null,
    views: connected.reduce((s, a) => s + a.views, 0),
    likes: connected.reduce((s, a) => s + a.likes, 0),
    comments: connected.reduce((s, a) => s + a.comments, 0),
    shares: connected.reduce((s, a) => s + a.shares, 0),
    avgEngagementRate:
      engagementWeight > 0 ? engagementWeighted / engagementWeight : null,
    hasConnectedAccount: true,
  };
}

export function aggregateEngagementTargetsWeighted(
  accounts: InsightTargetAccountRef[],
  getAccountActuals: (account: InsightTargetAccountRef) => PlatformPeriodActuals,
  formMap: Record<string, string>,
): number | null {
  let engagementWeighted = 0;
  let engagementWeight = 0;
  const unweightedTargets: number[] = [];

  for (const account of accounts) {
    const rawTarget =
      formMap[
        insightTargetCellKey(account.platform, account.accountId, "avg_engagement_rate")
      ]?.trim() ?? "";
    if (!rawTarget) continue;
    const parsed = Number(rawTarget);
    if (!Number.isFinite(parsed) || parsed < 0) continue;

    unweightedTargets.push(parsed);
    const views = getAccountActuals(account).views;
    if (views > 0) {
      engagementWeighted += parsed * views;
      engagementWeight += views;
    }
  }

  if (engagementWeight > 0) return engagementWeighted / engagementWeight;
  if (unweightedTargets.length === 0) return null;
  return (
    unweightedTargets.reduce((sum, value) => sum + value, 0) / unweightedTargets.length
  );
}

export function actualsFromAccountRow(
  account: SocialMediaInsightAccountRow,
): PlatformPeriodActuals {
  if (!account.connected || account.isPlatformPlaceholder || account.error) {
    return {
      audience: null,
      views: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      avgEngagementRate: null,
      hasConnectedAccount: false,
    };
  }

  const hasAudience =
    account.audienceCount != null && !account.audienceHidden;

  return {
    audience: hasAudience ? account.audienceCount : null,
    views: account.totalViews,
    likes: account.totalLikes,
    comments: account.totalComments,
    shares: account.totalShares,
    avgEngagementRate: account.avgEngagementRate,
    hasConnectedAccount: true,
  };
}

export function aggregateInsightActualsByPlatform(
  accounts: SocialMediaInsightAccountRow[],
): Record<InsightTargetPlatform, PlatformPeriodActuals> {
  const platforms: InsightTargetPlatform[] = ["tiktok", "youtube", "linkedin"];
  return platforms.reduce(
    (acc, platform) => {
      acc[platform] = summarizePlatformAccounts(
        accounts.filter((a) => a.platform === platform),
      );
      return acc;
    },
    {} as Record<InsightTargetPlatform, PlatformPeriodActuals>,
  );
}

export function actualValueForMetric(
  actuals: PlatformPeriodActuals,
  metric: InsightTargetMetric,
): number | null {
  switch (metric) {
    case "audience":
      return actuals.audience;
    case "views":
      return actuals.views;
    case "likes":
      return actuals.likes;
    case "comments":
      return actuals.comments;
    case "shares":
      return actuals.shares;
    case "avg_engagement_rate":
      return actuals.avgEngagementRate;
    default:
      return null;
  }
}

export function formatActualReferenceValue(
  metric: InsightTargetMetric,
  value: number | null,
): string {
  if (value == null || !Number.isFinite(value)) return "—";
  if (metric === "avg_engagement_rate") return `${value.toFixed(2)}%`;
  return value.toLocaleString();
}
