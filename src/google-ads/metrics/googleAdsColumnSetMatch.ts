import type { GoogleAdsColumnSet } from "@/google-ads/hooks/useGoogleAdsColumnSets";
import { isOptionalIdentityColumnKey, stripGoogleAdsPinnedMetricKeys } from "@/google-ads/metrics/googleAdsIdentityColumns";
import { isSynckerjaLeadsMetricKey } from "@/google-ads/metrics/googleAdsSynckerjaLeadsMetrics";
import { isSynckerjaTrafficMetricKey } from "@/google-ads/metrics/googleAdsSynckerjaTrafficMetrics";
import type { GoogleAdsMetricEntity } from "@/google-ads/metrics/types";

export function columnKeysMatch(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((key, index) => key === b[index]);
}

export function columnKeysMatchOrderIndependent(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((key, index) => key === sortedB[index]);
}

/** Match current preference keys to a named column set (exact order, then unordered). */
export function findMatchingGoogleAdsColumnSet(
  columnSets: GoogleAdsColumnSet[],
  keys: string[],
): GoogleAdsColumnSet | null {
  const normalizedKeys = stripGoogleAdsPinnedMetricKeys(keys);
  if (normalizedKeys.length === 0) return null;
  return (
    columnSets.find((set) => columnKeysMatch(stripGoogleAdsPinnedMetricKeys(set.metric_keys), normalizedKeys)) ??
    columnSets.find((set) =>
      columnKeysMatchOrderIndependent(stripGoogleAdsPinnedMetricKeys(set.metric_keys), normalizedKeys),
    ) ??
    null
  );
}

/**
 * Keys allowed in preferences / column-set apply for an entity
 * (catalog, conversion actions, UI custom, optional identity, Synckerja metrics).
 */
export function filterGoogleAdsPreferenceMetricKeys(
  entity: GoogleAdsMetricEntity,
  keys: string[],
  validMetricKeys: Set<string> | null | undefined,
): string[] {
  return stripGoogleAdsPinnedMetricKeys(keys).filter(
    (k) =>
      validMetricKeys?.has(k) ||
      k.startsWith("conv_action:") ||
      k.startsWith("ui_custom:") ||
      isOptionalIdentityColumnKey(entity, k) ||
      isSynckerjaTrafficMetricKey(k) ||
      isSynckerjaLeadsMetricKey(k),
  );
}
