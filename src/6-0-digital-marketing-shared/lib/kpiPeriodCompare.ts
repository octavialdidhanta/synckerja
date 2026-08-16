import { parseYmdLocal } from "@/6-0-google-ads/lib/googleAdsDatePresets";
import { resolveDmReportMetricDirection } from "@/6-0-digital-marketing-shared/dmReportMetricDirections";
import type { DmReportMetricDirectionsMap } from "@/6-0-digital-marketing-shared/dmReportMetricDirections";

export type KpiCompareDirection = "up" | "down" | "flat";
export type KpiCompareTone = "good" | "bad" | "neutral";

export type KpiCompareDelta = {
  percent: number | null;
  direction: KpiCompareDirection;
  formattedPercent: string;
};

export function computeKpiCompareDelta(
  current: number | null,
  previous: number | null,
): KpiCompareDelta | null {
  if (current == null || previous == null) return null;

  if (previous === 0) {
    if (current === 0) {
      return { percent: 0, direction: "flat", formattedPercent: "0%" };
    }
    return { percent: null, direction: "flat", formattedPercent: "—" };
  }

  const raw = ((current - previous) / previous) * 100;
  const direction: KpiCompareDirection = raw > 0 ? "up" : raw < 0 ? "down" : "flat";
  const abs = Math.abs(raw);
  const rounded = abs < 10 ? Math.round(abs * 10) / 10 : Math.round(abs);
  const formattedPercent = Number.isInteger(rounded) ? `${rounded}%` : `${rounded.toFixed(1)}%`;
  return { percent: raw, direction, formattedPercent };
}

/** Compact compare window: `15 Aug`, `1–30 Jun`, `18 Jun–17 Jul`. Year only if needed. */
export function formatCompareDateRange(
  fromYmd: string,
  toYmd: string,
  now: Date = new Date(),
  options?: { compact?: boolean },
): string {
  const from = parseYmdLocal(fromYmd);
  const to = parseYmdLocal(toYmd);
  if (!from || !to) return "";

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const day = (d: Date) => String(d.getDate());
  const month = (d: Date) => months[d.getMonth()];
  const showYear =
    from.getFullYear() !== to.getFullYear() || from.getFullYear() !== now.getFullYear();
  const compact = options?.compact === true;

  if (fromYmd === toYmd) {
    return showYear ? `${day(from)} ${month(from)} ${from.getFullYear()}` : `${day(from)} ${month(from)}`;
  }

  if (from.getFullYear() === to.getFullYear() && from.getMonth() === to.getMonth()) {
    const sameMonth = `${day(from)}–${day(to)} ${month(to)}`;
    return showYear ? `${sameMonth} ${to.getFullYear()}` : sameMonth;
  }

  if (compact) {
    if (from.getFullYear() === to.getFullYear()) {
      const monthsOnly = `${month(from)}–${month(to)}`;
      return showYear ? `${monthsOnly} ${to.getFullYear()}` : monthsOnly;
    }
    return `${month(from)} ${from.getFullYear()}–${month(to)} ${to.getFullYear()}`;
  }

  if (from.getFullYear() === to.getFullYear()) {
    const crossMonth = `${day(from)} ${month(from)}–${day(to)} ${month(to)}`;
    return showYear ? `${crossMonth} ${to.getFullYear()}` : crossMonth;
  }

  return `${day(from)} ${month(from)} ${from.getFullYear()}–${day(to)} ${month(to)} ${to.getFullYear()}`;
}

/** Arrow follows numeric change; color follows whether that change is good for the metric. */
export function kpiCompareTone(
  direction: KpiCompareDirection,
  metricKey: string,
  directions?: DmReportMetricDirectionsMap | null,
): KpiCompareTone {
  if (direction === "flat") return "neutral";
  const metricDir = resolveDmReportMetricDirection(metricKey, directions);
  if (metricDir === "lower_is_better") {
    return direction === "down" ? "good" : "bad";
  }
  return direction === "up" ? "good" : "bad";
}

export function kpiCompareToneClass(tone: KpiCompareTone): string {
  if (tone === "good") return "text-emerald-600";
  if (tone === "bad") return "text-red-600";
  return "text-muted-foreground";
}
