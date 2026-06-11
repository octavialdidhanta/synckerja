import type { InsightTargetPeriodKey } from "@/6-0-social-media-performance-shared/socialMediaInsightTargetTypes";

export const SOCIAL_MEDIA_INSIGHT_TARGETS_PATH =
  "/digital-marketing/social-media-performance/report/targets";

export function buildInsightTargetsPath(period?: InsightTargetPeriodKey): string {
  if (!period) return SOCIAL_MEDIA_INSIGHT_TARGETS_PATH;
  const params = new URLSearchParams();
  params.set("periodType", period.periodType);
  params.set("year", String(period.year));
  if (period.periodType === "monthly" && period.month != null) {
    params.set("month", String(period.month));
  }
  if (period.periodType === "quarterly" && period.quarter != null) {
    params.set("quarter", String(period.quarter));
  }
  return `${SOCIAL_MEDIA_INSIGHT_TARGETS_PATH}?${params.toString()}`;
}
