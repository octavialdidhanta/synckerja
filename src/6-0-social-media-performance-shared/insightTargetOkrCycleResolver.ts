import { endOfMonth, endOfQuarter, startOfDay, startOfMonth } from "date-fns";
import type { InsightTargetPeriodKey } from "@/6-0-social-media-performance-shared/socialMediaInsightTargetTypes";
import type { OkrCycle } from "@/shared/hooks/useOkrCycles";

function periodBounds(period: InsightTargetPeriodKey): { start: Date; end: Date } {
  if (period.periodType === "monthly" && period.month != null) {
    const start = startOfMonth(new Date(period.year, period.month - 1, 1));
    return { start, end: endOfMonth(start) };
  }
  const quarter = period.quarter ?? 1;
  const startMonth = (quarter - 1) * 3;
  const start = startOfDay(new Date(period.year, startMonth, 1));
  return { start, end: endOfQuarter(start) };
}

function quarterLabelToNumber(quarter?: string | null): number | null {
  if (!quarter) return null;
  const match = /^Q?(\d)$/i.exec(quarter.trim());
  if (!match) return null;
  const n = Number(match[1]);
  return n >= 1 && n <= 4 ? n : null;
}

function cycleOverlapsPeriod(cycle: OkrCycle, periodStart: Date, periodEnd: Date): boolean {
  const cycleStart = startOfDay(new Date(cycle.start_date));
  const cycleEnd = startOfDay(new Date(cycle.end_date));
  return cycleStart.getTime() <= periodEnd.getTime() && cycleEnd.getTime() >= periodStart.getTime();
}

/** Resolve the best OKR cycle for an insight target period. */
export function resolveOkrCycleForInsightPeriod(
  period: InsightTargetPeriodKey,
  cycles: OkrCycle[],
): OkrCycle | null {
  if (cycles.length === 0) return null;

  const { start: periodStart, end: periodEnd } = periodBounds(period);

  if (period.periodType === "quarterly" && period.quarter != null) {
    const exact = cycles.find((c) => {
      const q = quarterLabelToNumber(c.quarter);
      return c.year === period.year && q === period.quarter && cycleOverlapsPeriod(c, periodStart, periodEnd);
    });
    if (exact) return exact;
  }

  const overlapping = cycles.filter((c) => cycleOverlapsPeriod(c, periodStart, periodEnd));
  if (overlapping.length > 0) {
    const active = overlapping.find((c) => c.is_active);
    return active ?? overlapping[0];
  }

  const active = cycles.find((c) => c.is_active);
  return active ?? null;
}

export function buildInsightObjectiveTitle(period: InsightTargetPeriodKey): string {
  if (period.periodType === "monthly" && period.month != null) {
    const monthName = new Date(period.year, period.month - 1, 1).toLocaleString(undefined, {
      month: "long",
    });
    return `Social Media KPI — ${monthName} ${period.year}`;
  }
  const q = period.quarter ?? 1;
  return `Social Media KPI — Q${q} ${period.year}`;
}
