import type { GoogleAdsReportTargetPeriodKey } from "@/6-0-digital-marketing-shared/googleAdsReportTargetTypes";

function periodSegment(period: GoogleAdsReportTargetPeriodKey | null): string {
  if (!period) return "none";
  if (period.periodType === "monthly") {
    return `m:${period.year}:${period.month ?? 0}`;
  }
  return `q:${period.year}:${period.quarter ?? 0}`;
}

export const googleAdsReportTargetQueryKeys = {
  all: (orgId: string | null | undefined) =>
    ["google-ads-report-targets", orgId] as const,
  targets: (orgId: string | null | undefined, period: GoogleAdsReportTargetPeriodKey | null) =>
    [...googleAdsReportTargetQueryKeys.all(orgId), "targets", periodSegment(period)] as const,
  assignments: (orgId: string | null | undefined, period: GoogleAdsReportTargetPeriodKey | null) =>
    [...googleAdsReportTargetQueryKeys.all(orgId), "assignments", periodSegment(period)] as const,
  periodSettings: (orgId: string | null | undefined, period: GoogleAdsReportTargetPeriodKey | null) =>
    [...googleAdsReportTargetQueryKeys.all(orgId), "period-settings", periodSegment(period)] as const,
  accounts: (orgId: string | null | undefined) =>
    [...googleAdsReportTargetQueryKeys.all(orgId), "accounts"] as const,
  actuals: (
    orgId: string | null | undefined,
    period: GoogleAdsReportTargetPeriodKey | null,
    metricKeys: string[],
    customerIds: string[],
  ) =>
    [
      ...googleAdsReportTargetQueryKeys.all(orgId),
      "actuals",
      periodSegment(period),
      [...metricKeys].sort().join("|"),
      [...customerIds].sort().join("|"),
    ] as const,
  metricsByObjective: (orgId: string | null | undefined) =>
    [...googleAdsReportTargetQueryKeys.all(orgId), "metrics-by-objective"] as const,
  weeklyCheckinActuals: (
    orgId: string | null | undefined,
    objectiveId: string | undefined,
    weekKeys: string,
  ) =>
    [
      ...googleAdsReportTargetQueryKeys.all(orgId),
      "weekly-checkin",
      objectiveId,
      weekKeys,
    ] as const,
};
