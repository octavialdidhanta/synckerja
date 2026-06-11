import { resolveOkrCycleForInsightPeriod } from "@/6-0-social-media-performance-shared/insightTargetOkrCycleResolver";
import type { DmReportTargetPeriodKey } from "@/6-0-digital-marketing-shared/dmReportTargetTypes";
import type { OkrCycle } from "@/shared/hooks/useOkrCycles";

export { resolveOkrCycleForInsightPeriod as resolveOkrCycleForDmReportPeriod };

export function buildDmReportObjectiveTitle(period: DmReportTargetPeriodKey): string {
  if (period.periodType === "monthly" && period.month != null) {
    const monthName = new Date(period.year, period.month - 1, 1).toLocaleString(undefined, {
      month: "long",
    });
    return `Digital Marketing KPI — ${monthName} ${period.year}`;
  }
  const q = period.quarter ?? 1;
  return `Digital Marketing KPI — Q${q} ${period.year}`;
}
