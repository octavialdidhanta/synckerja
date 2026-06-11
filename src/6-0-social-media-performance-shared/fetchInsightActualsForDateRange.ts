import { fetchInsightAccountMetrics } from "@/6-0-social-media-performance-shared/fetchInsightAccountMetrics";
import {
  actualsFromAccountRow,
  actualValueForMetric,
} from "@/6-0-social-media-performance-shared/insightTargetPlatformActuals";
import type {
  InsightTargetMetric,
  InsightTargetPlatform,
} from "@/6-0-social-media-performance-shared/socialMediaInsightTargetTypes";

export async function fetchInsightActualForAccountMetric(args: {
  organizationId: string;
  platform: InsightTargetPlatform;
  accountId: string;
  accountLabel?: string;
  avatarUrl?: string | null;
  metric: InsightTargetMetric;
  dateStart: string;
  dateEnd: string;
}): Promise<number | null> {
  const row = await fetchInsightAccountMetrics(
    args.organizationId,
    {
      platform: args.platform,
      accountId: args.accountId,
      accountLabel: args.accountLabel ?? args.accountId,
      avatarUrl: args.avatarUrl ?? null,
    },
    args.dateStart,
    args.dateEnd,
  );
  const actuals = actualsFromAccountRow(row);
  return actualValueForMetric(actuals, args.metric);
}
