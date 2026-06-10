import type { TikTokAdsMetricEntity } from "@/tiktok-ads/hooks/useTikTokAdsMetricsQuery";
import {
  TIKTOK_ADS_SUMMARY_DEFAULT_SLOT_KEYS,
  TIKTOK_ADS_SUMMARY_SLOT_COUNT,
} from "@/tiktok-ads/metrics/tiktokAdsSummaryMetrics";

const STORAGE_PREFIX = "tiktok-ads-summary-slot-metrics:";

export function loadTikTokAdsSummarySlotMetrics(entity: TikTokAdsMetricEntity): string[] {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${entity}`);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed) && parsed.length === TIKTOK_ADS_SUMMARY_SLOT_COUNT) {
        return parsed.map((k, i) => {
          const key = String(k).trim();
          return key || (TIKTOK_ADS_SUMMARY_DEFAULT_SLOT_KEYS[i] ?? "spend");
        });
      }
    }
  } catch {
    /* ignore */
  }
  return [...TIKTOK_ADS_SUMMARY_DEFAULT_SLOT_KEYS];
}

export function saveTikTokAdsSummarySlotMetrics(
  entity: TikTokAdsMetricEntity,
  keys: string[],
): void {
  try {
    localStorage.setItem(
      `${STORAGE_PREFIX}${entity}`,
      JSON.stringify(keys.slice(0, TIKTOK_ADS_SUMMARY_SLOT_COUNT)),
    );
  } catch {
    /* ignore */
  }
}
