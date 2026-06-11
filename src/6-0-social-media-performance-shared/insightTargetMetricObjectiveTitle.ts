import type {
  InsightTargetMetric,
  InsightTargetPeriodKey,
  InsightTargetPlatform,
} from "@/6-0-social-media-performance-shared/socialMediaInsightTargetTypes";

const PLATFORM_LABELS: Record<InsightTargetPlatform, string> = {
  tiktok: "TikTok",
  youtube: "YouTube",
  linkedin: "LinkedIn",
};

const METRIC_LABELS: Record<InsightTargetMetric, string> = {
  audience: "Audience",
  views: "Views",
  likes: "Likes",
  comments: "Comments",
  shares: "Shares",
  avg_engagement_rate: "Avg. engagement",
};

function periodSuffix(period: InsightTargetPeriodKey): string {
  if (period.periodType === "monthly" && period.month != null) {
    const monthName = new Date(period.year, period.month - 1, 1).toLocaleString(undefined, {
      month: "short",
    });
    return `${monthName} ${period.year}`;
  }
  return `Q${period.quarter ?? 1} ${period.year}`;
}

export function buildInsightMetricObjectiveTitle(args: {
  platform: InsightTargetPlatform;
  accountLabel: string;
  metric: InsightTargetMetric;
  period: InsightTargetPeriodKey;
}): string {
  const platform = PLATFORM_LABELS[args.platform];
  const metric = METRIC_LABELS[args.metric];
  return `${platform} · ${args.accountLabel} · ${metric} (${periodSuffix(args.period)})`;
}
