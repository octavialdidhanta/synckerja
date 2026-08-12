import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_SUMMARY_SLOT_KEYS,
  loadSummarySlotMetrics,
  saveSummarySlotMetrics,
} from "@/google-ads/metrics/googleAdsSummaryMetricOptions";
import type {
  GoogleAdsMetricEntity,
  GoogleAdsSummaryMetricOption,
} from "@/google-ads/metrics/types";

function normalizeSlotKeyAgainstOptions(
  key: string,
  index: number,
  optionKeys: Set<string>,
): string {
  const normalized =
    key === "spent" ? (DEFAULT_SUMMARY_SLOT_KEYS[index] ?? "impressions") : key;
  if (optionKeys.has(normalized)) return normalized;
  return DEFAULT_SUMMARY_SLOT_KEYS[index] ?? "impressions";
}

/**
 * Shared summary-slot metric keys (localStorage + option validation).
 * Desktop and mobile UIs both use this so slot logic stays in sync.
 */
export function useGoogleAdsSummarySlotMetrics(
  entity: GoogleAdsMetricEntity,
  summaryMetricOptions: GoogleAdsSummaryMetricOption[],
) {
  const [summarySlotMetricKeys, setSummarySlotMetricKeys] = useState(() =>
    loadSummarySlotMetrics(entity),
  );

  /** Stable content key so parent recreating `[]` / options arrays does not re-trigger. */
  const optionsKey = useMemo(
    () => summaryMetricOptions.map((o) => o.key).join("\0"),
    [summaryMetricOptions],
  );

  useEffect(() => {
    setSummarySlotMetricKeys(loadSummarySlotMetrics(entity));
  }, [entity]);

  useEffect(() => {
    if (!optionsKey) return;
    const optionKeys = new Set(optionsKey.split("\0").filter(Boolean));
    if (optionKeys.size === 0) return;

    setSummarySlotMetricKeys((prev) => {
      let changed = false;
      const next = prev.map((key, i) => {
        const normalized = normalizeSlotKeyAgainstOptions(key, i, optionKeys);
        if (normalized !== key) changed = true;
        return normalized;
      });
      return changed ? next : prev;
    });
  }, [optionsKey]);

  const handleSummarySlotMetricChange = useCallback(
    (slotIndex: number, key: string) => {
      setSummarySlotMetricKeys((prev) => {
        const next = [...prev];
        next[slotIndex] = key;
        saveSummarySlotMetrics(entity, next);
        return next;
      });
    },
    [entity],
  );

  return {
    summarySlotMetricKeys,
    handleSummarySlotMetricChange,
  };
}
