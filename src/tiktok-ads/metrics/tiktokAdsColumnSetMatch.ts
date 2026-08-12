import type { TikTokAdsColumnSet } from "@/tiktok-ads/hooks/useTikTokAdsColumnSets";

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
export function findMatchingTikTokAdsColumnSet(
  columnSets: TikTokAdsColumnSet[],
  keys: string[],
): TikTokAdsColumnSet | null {
  if (keys.length === 0) return null;
  const orgMatch =
    columnSets.find(
      (set) => set.scope === "org" && columnKeysMatch(set.metric_keys, keys),
    ) ??
    columnSets.find(
      (set) =>
        set.scope === "org" && columnKeysMatchOrderIndependent(set.metric_keys, keys),
    );
  if (orgMatch) return orgMatch;
  return (
    columnSets.find((set) => columnKeysMatch(set.metric_keys, keys)) ??
    columnSets.find((set) => columnKeysMatchOrderIndependent(set.metric_keys, keys)) ??
    null
  );
}

/** Keys allowed when applying a column set. */
export function filterTikTokAdsPreferenceMetricKeys(
  keys: string[],
  validMetricKeys: Set<string> | null | undefined,
): string[] {
  if (!validMetricKeys) return keys;
  return keys.filter((k) => validMetricKeys.has(k));
}
