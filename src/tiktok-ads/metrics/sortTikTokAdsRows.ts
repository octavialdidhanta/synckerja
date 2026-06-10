import type { TikTokAdsMetricEntity } from "@/tiktok-ads/hooks/useTikTokAdsMetricsQuery";
import type { TikTokAdsMetricsRow } from "@/tiktok-ads/hooks/useTikTokAdsMetricsQuery";
import type { TikTokAdsMetricsSort } from "@/tiktok-ads/metrics/tiktokAdsSortColumns";
import { getTikTokAdsSortColumnKind } from "@/tiktok-ads/metrics/tiktokAdsSortColumns";
import { tiktokAdsRowSortKey } from "@/tiktok-ads/metrics/tiktokAdsRowIdentity";

export function sortTikTokAdsRows(
  rows: TikTokAdsMetricsRow[],
  sort: TikTokAdsMetricsSort,
  entity: TikTokAdsMetricEntity,
): TikTokAdsMetricsRow[] {
  const kind = getTikTokAdsSortColumnKind(sort.field);
  const dir = sort.direction === "asc" ? 1 : -1;

  return [...rows].sort((a, b) => {
    const av = tiktokAdsRowSortKey(a, sort.field, entity);
    const bv = tiktokAdsRowSortKey(b, sort.field, entity);

    if (kind === "numeric") {
      const an = typeof av === "number" ? av : 0;
      const bn = typeof bv === "number" ? bv : 0;
      if (an === bn) return 0;
      return an < bn ? -dir : dir;
    }

    const as = String(av);
    const bs = String(bv);
    return as.localeCompare(bs, undefined, { sensitivity: "base" }) * dir;
  });
}
