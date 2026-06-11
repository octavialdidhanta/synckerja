import { resolveOkrCycleForInsightPeriod } from "@/6-0-social-media-performance-shared/insightTargetOkrCycleResolver";
import type { GoogleAdsReportTargetPeriodKey } from "@/6-0-digital-marketing-shared/googleAdsReportTargetTypes";
import type { OkrCycle } from "@/shared/hooks/useOkrCycles";

export { resolveOkrCycleForInsightPeriod as resolveOkrCycleForGoogleAdsReportPeriod };

export function buildGoogleAdsReportObjectiveTitle(period: GoogleAdsReportTargetPeriodKey): string {
  if (period.periodType === "monthly" && period.month != null) {
    const monthName = new Date(period.year, period.month - 1, 1).toLocaleString(undefined, {
      month: "long",
    });
    return `Google Ads KPI — ${monthName} ${period.year}`;
  }
  const q = period.quarter ?? 1;
  return `Google Ads KPI — Q${q} ${period.year}`;
}

/** @deprecated Use buildGoogleAdsReportObjectiveTitle */
export const buildInsightObjectiveTitleForGoogleAds = buildGoogleAdsReportObjectiveTitle;
