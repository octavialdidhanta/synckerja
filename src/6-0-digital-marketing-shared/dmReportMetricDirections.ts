import { dmTargetCellKey } from "@/6-0-digital-marketing-shared/dmReportTargetTypes";
import type { DmReportTargetDirection } from "@/6-0-digital-marketing-shared/dmReportTargetProgressMath";

export type DmReportMetricDirectionsMap = Record<string, DmReportTargetDirection>;

const LOWER_IS_BETTER_DEFAULTS = new Set([
  "cost",
  "spent",
  "cpc",
  "avg_cpc",
  "avg_cost",
  "cpa",
  "cost_per_conv",
  "cpm",
]);

export function defaultDmReportMetricDirection(metricKey: string): DmReportTargetDirection {
  const normalized = metricKey.toLowerCase();
  if (LOWER_IS_BETTER_DEFAULTS.has(normalized) || normalized.includes("cost")) {
    return "lower_is_better";
  }
  return "higher_is_better";
}

export function parseMetricDirectionsFromSettings(
  raw: unknown,
): DmReportMetricDirectionsMap {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const map: DmReportMetricDirectionsMap = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (value === "higher_is_better" || value === "lower_is_better") {
      map[key] = value;
    }
  }
  return map;
}

export function resolveDmReportMetricDirection(
  metricKey: string,
  directions?: DmReportMetricDirectionsMap | null,
): DmReportTargetDirection {
  const fromSettings = directions?.[metricKey];
  if (fromSettings === "higher_is_better" || fromSettings === "lower_is_better") {
    return fromSettings;
  }
  return defaultDmReportMetricDirection(metricKey);
}

export function normalizeMetricDirectionsForMetrics(
  selectedMetrics: string[],
  stored?: DmReportMetricDirectionsMap | null,
): DmReportMetricDirectionsMap {
  const base = { ...(stored ?? {}) };
  for (const metricKey of selectedMetrics) {
    if (!base[metricKey]) {
      base[metricKey] = defaultDmReportMetricDirection(metricKey);
    }
  }
  return base;
}

/**
 * Save/input rule vs current actual:
 * Desc → target ≤ actual · Asc → target ≥ actual
 */
export function isDmReportTargetRespectingToggle(
  target: number,
  actual: number | null,
  metricKey: string,
  directions?: DmReportMetricDirectionsMap | null,
): boolean {
  if (!Number.isFinite(target) || target <= 0) return true;
  if (actual == null || !Number.isFinite(actual) || actual <= 0) return true;

  if (resolveDmReportMetricDirection(metricKey, directions) === "lower_is_better") {
    return target <= actual;
  }
  return target >= actual;
}

/** Desc: actual ≤ target (on track). Asc: actual ≥ target (on track). */
export function isDmReportActualOnTrackForDirection(
  actual: number | null,
  target: number,
  metricKey: string,
  directions?: DmReportMetricDirectionsMap | null,
): boolean {
  if (!Number.isFinite(target) || target <= 0) return true;
  if (actual == null || !Number.isFinite(actual)) return true;

  if (resolveDmReportMetricDirection(metricKey, directions) === "lower_is_better") {
    return actual <= target;
  }
  return actual >= target;
}

export type DmTargetToggleViolation = {
  cellKey: string;
  metricKey: string;
  accountLabel: string;
  channel: string;
  accountId: string;
  isDesc: boolean;
};

export function collectDmReportTargetToggleViolations(args: {
  accounts: Array<{ channel: string; accountId: string; accountLabel: string }>;
  selectedMetricsByChannel: Record<string, string[]>;
  formMap: Record<string, string>;
  getActual: (channel: string, accountId: string, metricKey: string) => number | null;
  metricDirections?: DmReportMetricDirectionsMap | null;
  hasConnectedAccount?: (channel: string, accountId: string) => boolean;
  periodNotStarted?: boolean;
}): DmTargetToggleViolation[] {
  if (args.periodNotStarted) return [];

  const violations: DmTargetToggleViolation[] = [];

  for (const account of args.accounts) {
    const channelMetrics = args.selectedMetricsByChannel[account.channel] ?? [];
    for (const metricKey of channelMetrics) {
      const cellKey = dmTargetCellKey(
        account.channel as "google" | "meta" | "tiktok",
        account.accountId,
        metricKey,
      );
      const raw = args.formMap[cellKey]?.trim() ?? "";
      if (!raw) continue;

      const parsed = Number(raw);
      if (!Number.isFinite(parsed) || parsed <= 0) continue;

      if (args.hasConnectedAccount && !args.hasConnectedAccount(account.channel, account.accountId)) {
        continue;
      }

      const actual = args.getActual(account.channel, account.accountId, metricKey);
      if (actual == null || actual <= 0) continue;

      if (!isDmReportTargetRespectingToggle(parsed, actual, metricKey, args.metricDirections)) {
        const isDesc =
          resolveDmReportMetricDirection(metricKey, args.metricDirections) === "lower_is_better";
        violations.push({
          cellKey,
          metricKey,
          accountLabel: account.accountLabel,
          channel: account.channel,
          accountId: account.accountId,
          isDesc,
        });
      }
    }
  }

  return violations;
}

export function clearDmReportTargetToggleViolations(
  formMap: Record<string, string>,
  violations: DmTargetToggleViolation[],
): Record<string, string> {
  if (violations.length === 0) return formMap;
  const next = { ...formMap };
  for (const violation of violations) {
    next[violation.cellKey] = "";
  }
  return next;
}

export function dmReportSuggestedCheckinStatus(
  actual: number | null,
  target: number,
  metricKey: string,
  directions?: DmReportMetricDirectionsMap | null,
): "on_track" | "at_risk" | "off_track" {
  if (!Number.isFinite(target) || target <= 0 || actual == null || !Number.isFinite(actual)) {
    return "on_track";
  }

  const direction = resolveDmReportMetricDirection(metricKey, directions);
  if (direction === "lower_is_better") {
    if (actual <= target) return "on_track";
    const overRatio = actual / target;
    if (overRatio <= 1.1) return "at_risk";
    return "off_track";
  }

  if (actual >= target) return "on_track";
  const underRatio = actual / target;
  if (underRatio >= 0.9) return "at_risk";
  return "off_track";
}
