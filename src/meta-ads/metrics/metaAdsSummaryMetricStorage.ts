import type { MetaAdsMetricEntity } from "@/meta-ads/hooks/useMetaAdsMetricsQuery";
import {
  META_ADS_SUMMARY_DEFAULT_SLOT_KEYS,
  META_ADS_SUMMARY_SLOT_COUNT,
} from "@/meta-ads/metrics/metaAdsSummaryMetrics";

const STORAGE_PREFIX = "meta-ads-summary-slot-metrics:";

export function loadMetaAdsSummarySlotMetrics(entity: MetaAdsMetricEntity): string[] {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${entity}`);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed) && parsed.length === META_ADS_SUMMARY_SLOT_COUNT) {
        return parsed.map((k, i) => {
          const key = String(k).trim();
          return key || (META_ADS_SUMMARY_DEFAULT_SLOT_KEYS[i] ?? "spend");
        });
      }
    }
  } catch {
    /* ignore */
  }
  return [...META_ADS_SUMMARY_DEFAULT_SLOT_KEYS];
}

export function saveMetaAdsSummarySlotMetrics(
  entity: MetaAdsMetricEntity,
  keys: string[],
): void {
  try {
    localStorage.setItem(
      `${STORAGE_PREFIX}${entity}`,
      JSON.stringify(keys.slice(0, META_ADS_SUMMARY_SLOT_COUNT)),
    );
  } catch {
    /* ignore */
  }
}
