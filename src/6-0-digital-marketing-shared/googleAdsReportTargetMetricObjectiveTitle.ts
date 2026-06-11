import type { GoogleAdsReportTargetPeriodKey } from "@/6-0-digital-marketing-shared/googleAdsReportTargetTypes";

function periodSuffix(period: GoogleAdsReportTargetPeriodKey): string {
  if (period.periodType === "monthly" && period.month != null) {
    const monthName = new Date(period.year, period.month - 1, 1).toLocaleString(undefined, {
      month: "short",
    });
    return `${monthName} ${period.year}`;
  }
  return `Q${period.quarter ?? 1} ${period.year}`;
}

export function buildGoogleAdsReportMetricObjectiveTitle(args: {
  accountLabel: string;
  metricLabel: string;
  period: GoogleAdsReportTargetPeriodKey;
}): string {
  return `Google Ads · ${args.accountLabel} · ${args.metricLabel} (${periodSuffix(args.period)})`;
}
