import type { MetaAdsColumnSet } from "@/meta-ads/hooks/useMetaAdsColumnSets";
import {
  isMetaAdsSynckerjaMetricKey,
  stripMetaAdsPinnedMetricKeys,
} from "@/meta-ads/metrics/metaAdsMetricCatalog";

export function columnKeysMatch(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((key, index) => key === b[index]);
}

export function columnKeysMatchOrderIndependent(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((key, index) => key === sortedB[index]);
}

/** Match current preference keys to a named column set (org exact/unordered, then any). */
export function findMatchingMetaAdsColumnSet(
  columnSets: MetaAdsColumnSet[],
  keys: string[],
): MetaAdsColumnSet | null {
  const normalizedKeys = stripMetaAdsPinnedMetricKeys(keys);
  if (normalizedKeys.length === 0) return null;
  const normalizeSetKeys = (set: MetaAdsColumnSet) => stripMetaAdsPinnedMetricKeys(set.metric_keys);
  const orgMatch =
    columnSets.find(
      (set) => set.scope === "org" && columnKeysMatch(normalizeSetKeys(set), normalizedKeys),
    ) ??
    columnSets.find(
      (set) =>
        set.scope === "org" &&
        columnKeysMatchOrderIndependent(normalizeSetKeys(set), normalizedKeys),
    );
  if (orgMatch) return orgMatch;
  return (
    columnSets.find((set) => columnKeysMatch(normalizeSetKeys(set), normalizedKeys)) ??
    columnSets.find((set) =>
      columnKeysMatchOrderIndependent(normalizeSetKeys(set), normalizedKeys),
    ) ??
    null
  );
}

/** Keys allowed when applying a column set. */
export function filterMetaAdsPreferenceMetricKeys(
  keys: string[],
  validMetricKeys: Set<string> | null | undefined,
): string[] {
  return stripMetaAdsPinnedMetricKeys(keys).filter(
    (k) => validMetricKeys?.has(k) || isMetaAdsSynckerjaMetricKey(k),
  );
}
