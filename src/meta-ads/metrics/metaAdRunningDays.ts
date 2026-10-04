import { parseMetricNumber } from "@/meta-ads/metrics/formatMetaMetricValue";

export type MetaAdRunningDaysTone =
  | "week-green"
  | "week-lime"
  | "week-yellow"
  | "week-amber"
  | "ctr-green"
  | "ctr-yellow"
  | "ctr-red";

/** Calendar days the ad has existed, including the day it was created. */
export function metaAdRunningDays(createdTime: unknown, now = new Date()): number | null {
  if (createdTime == null || createdTime === "") return null;
  const created = createdTime instanceof Date ? createdTime : new Date(String(createdTime).trim());
  if (Number.isNaN(created.getTime())) return null;
  const start = Date.UTC(created.getFullYear(), created.getMonth(), created.getDate());
  const end = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const elapsed = Math.round((end - start) / 86_400_000);
  if (elapsed < 0) return 0;
  return elapsed + 1;
}

/**
 * The first 14 days ignore CTR: green through day 7, yellow-green through day 14.
 * After that, CTR decides: above 2% green, 1%–2% yellow, below 1% red.
 */
export function metaAdRunningDaysTone(days: number, ctrPercent: number | null): MetaAdRunningDaysTone {
  if (days <= 7) return "week-green";
  if (days <= 14) return "week-lime";
  if (ctrPercent == null || !Number.isFinite(ctrPercent)) {
    return days <= 21 ? "week-yellow" : "week-amber";
  }
  if (ctrPercent > 2) return "ctr-green";
  if (ctrPercent >= 1) return "ctr-yellow";
  return "ctr-red";
}

/** Meta insight CTR is already a percent (1.5 means 1.5%). */
export function metaAdCtrPercent(value: unknown): number | null {
  return parseMetricNumber(value);
}
