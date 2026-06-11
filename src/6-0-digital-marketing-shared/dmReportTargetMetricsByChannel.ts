import { expandReportMetricsWithDependencies } from "@/6-0-digital-marketing-shared/dmReportTargetMetricMapping";
import type {
  DmReportChannel,
  DmReportTargetRow,
} from "@/6-0-digital-marketing-shared/dmReportTargetTypes";

export const DM_REPORT_CHANNELS: DmReportChannel[] = ["google", "meta", "tiktok"];

export type DmReportChannelMetricsMap = Record<DmReportChannel, string[]>;

export function emptyChannelMetricsMap(): DmReportChannelMetricsMap {
  return { google: [], meta: [], tiktok: [] };
}

export function parseChannelMetricsFromSettings(
  byChannel: unknown,
  legacyFlat?: string[] | null,
): DmReportChannelMetricsMap {
  const result = emptyChannelMetricsMap();
  const legacy = legacyFlat ?? [];

  if (byChannel && typeof byChannel === "object" && !Array.isArray(byChannel)) {
    const obj = byChannel as Record<string, unknown>;
    for (const channel of DM_REPORT_CHANNELS) {
      const raw = obj[channel];
      if (Array.isArray(raw)) {
        result[channel] = raw.filter((k): k is string => typeof k === "string");
      } else if (legacy.length > 0) {
        result[channel] = [...legacy];
      }
    }
    return result;
  }

  if (legacy.length > 0) {
    for (const channel of DM_REPORT_CHANNELS) {
      result[channel] = [...legacy];
    }
  }
  return result;
}

export function unionChannelMetrics(map: DmReportChannelMetricsMap): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const channel of DM_REPORT_CHANNELS) {
    for (const key of map[channel] ?? []) {
      if (!seen.has(key)) {
        seen.add(key);
        result.push(key);
      }
    }
  }
  return result;
}

export function hasAnyChannelMetrics(map: DmReportChannelMetricsMap): boolean {
  return DM_REPORT_CHANNELS.some((c) => (map[c]?.length ?? 0) > 0);
}

export function channelMetricsForAccount(
  map: DmReportChannelMetricsMap,
  channel: DmReportChannel,
): string[] {
  return map[channel] ?? [];
}

/** Merge settings, saved targets, and summary-slot metrics for period actual fetches. */
export function buildChannelMetricsMapForActuals(
  settings: DmReportChannelMetricsMap,
  progressMetricKeys: string[],
  targetRows: DmReportTargetRow[],
): DmReportChannelMetricsMap {
  const expandedProgress = expandReportMetricsWithDependencies(progressMetricKeys);
  const result = emptyChannelMetricsMap();

  for (const channel of DM_REPORT_CHANNELS) {
    const keys = new Set<string>([...(settings[channel] ?? [])]);
    for (const row of targetRows) {
      if (row.channel === channel) keys.add(row.metric_key);
    }
    for (const key of expandedProgress) keys.add(key);
    const unique = expandReportMetricsWithDependencies([...keys]);
    if (unique.length > 0) result[channel] = unique;
  }

  return result;
}
