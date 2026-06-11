import type { DmReportChannel, DmReportTargetPeriodKey } from "@/6-0-digital-marketing-shared/dmReportTargetTypes";

function periodSuffix(period: DmReportTargetPeriodKey): string {
  if (period.periodType === "monthly" && period.month != null) {
    const monthName = new Date(period.year, period.month - 1, 1).toLocaleString(undefined, {
      month: "short",
    });
    return `${monthName} ${period.year}`;
  }
  return `Q${period.quarter ?? 1} ${period.year}`;
}

const CHANNEL_PREFIX: Record<DmReportChannel, string> = {
  google: "Google Ads",
  meta: "Meta Ads",
  tiktok: "TikTok Ads",
};

export function buildDmReportMetricObjectiveTitle(args: {
  channel: DmReportChannel;
  accountLabel: string;
  metricLabel: string;
  period: DmReportTargetPeriodKey;
}): string {
  const prefix = CHANNEL_PREFIX[args.channel];
  return `${prefix} · ${args.accountLabel} · ${args.metricLabel} (${periodSuffix(args.period)})`;
}
