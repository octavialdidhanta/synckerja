import type { MetaAdsMetricEntity } from "@/meta-ads/hooks/useMetaAdsMetricsQuery";
import type { MetaAdsMetricsRow } from "@/meta-ads/hooks/useMetaAdsMetricsQuery";
import type { MetaAdsMetricsSort } from "@/meta-ads/metrics/metaAdsSortColumns";
import { getMetaAdsSortColumnKind } from "@/meta-ads/metrics/metaAdsSortColumns";
import { metaAdsRowSortKey } from "@/meta-ads/metrics/metaAdsRowIdentity";

export function sortMetaAdsRows(
  rows: MetaAdsMetricsRow[],
  sort: MetaAdsMetricsSort,
  entity: MetaAdsMetricEntity,
): MetaAdsMetricsRow[] {
  const kind = getMetaAdsSortColumnKind(sort.field);
  const dir = sort.direction === "asc" ? 1 : -1;

  return [...rows].sort((a, b) => {
    const av = metaAdsRowSortKey(a, sort.field, entity);
    const bv = metaAdsRowSortKey(b, sort.field, entity);

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
