import { GOOGLE_ADS_IDENTITY_COLUMNS } from "@/google-ads/metrics/googleAdsIdentityColumns";
import type { GoogleAdsMetricEntity, GoogleAdsMetricsSort, MetricCatalogItem } from "@/google-ads/metrics/types";

export type SortColumnOption = { key: string; label: string };

export type SortColumnKind = "text" | "numeric";

const NUMERIC_IDENTITY_KEYS = new Set(["service_cpl", "service_converted_leads"]);

/** Identity columns sort alphabetically; applied metrics sort numerically. */
export function getSortColumnKind(
  field: string,
  entity: GoogleAdsMetricEntity,
  metricItems: MetricCatalogItem[],
): SortColumnKind {
  if (NUMERIC_IDENTITY_KEYS.has(field)) return "numeric";
  const identityKeys = new Set(GOOGLE_ADS_IDENTITY_COLUMNS[entity].map((c) => c.key));
  if (identityKeys.has(field)) return "text";
  if (metricItems.some((m) => m.key === field)) return "numeric";
  return "text";
}

/** Text columns default A→Z; metrics default High→low. */
export function defaultSortDirectionForKind(kind: SortColumnKind): "asc" | "desc" {
  return kind === "text" ? "asc" : "desc";
}

export function sortDirectionLabelKeys(kind: SortColumnKind): {
  descKey: string;
  ascKey: string;
  descDefault: string;
  ascDefault: string;
} {
  if (kind === "text") {
    return {
      descKey: "digitalMarketing.googleAds.sortDescText",
      ascKey: "digitalMarketing.googleAds.sortAscText",
      descDefault: "Z → A",
      ascDefault: "A → Z",
    };
  }
  return {
    descKey: "digitalMarketing.googleAds.sortDescNumeric",
    ascKey: "digitalMarketing.googleAds.sortAscNumeric",
    descDefault: "High → low",
    ascDefault: "Low → high",
  };
}

/** Identity columns first, then applied metrics — matches table column order. */
export function buildSortColumnOptions(
  entity: GoogleAdsMetricEntity,
  metricItems: MetricCatalogItem[],
): SortColumnOption[] {
  const identity = GOOGLE_ADS_IDENTITY_COLUMNS[entity].map((c) => ({
    key: c.key,
    label: c.label,
  }));
  const metrics = metricItems.map((m) => ({ key: m.key, label: m.label }));
  return [...identity, ...metrics];
}

export function defaultSortForOptions(
  options: SortColumnOption[],
  entity: GoogleAdsMetricEntity,
  metricItems: MetricCatalogItem[],
): GoogleAdsMetricsSort {
  const preferred =
    entity === "campaign"
      ? (options.find((o) => o.key === "spent") ??
        options.find((o) => o.key === "name") ??
        options[0])
      : options[0];
  const field = preferred?.key ?? "spent";
  const kind = getSortColumnKind(field, entity, metricItems);
  return { field, direction: defaultSortDirectionForKind(kind) };
}

/** When current sort field is no longer available — prefer first metric, else first column. */
export function fallbackSortWhenFieldRemoved(
  options: SortColumnOption[],
  entity: GoogleAdsMetricEntity,
  metricItems: MetricCatalogItem[],
): GoogleAdsMetricsSort {
  const identityKeySet = new Set(GOOGLE_ADS_IDENTITY_COLUMNS[entity].map((c) => c.key));
  const firstMetric = options.find((o) => !identityKeySet.has(o.key));
  const field = firstMetric?.key ?? options[0]?.key ?? "spent";
  const kind = getSortColumnKind(field, entity, metricItems);
  return { field, direction: defaultSortDirectionForKind(kind) };
}

export function resolveSortForOptions(
  current: GoogleAdsMetricsSort,
  options: SortColumnOption[],
  entity: GoogleAdsMetricEntity,
  metricItems: MetricCatalogItem[],
): GoogleAdsMetricsSort {
  if (options.length === 0) return current;
  if (options.some((o) => o.key === current.field)) {
    return {
      field: current.field,
      direction: current.direction === "asc" ? "asc" : "desc",
    };
  }
  return fallbackSortWhenFieldRemoved(options, entity, metricItems);
}

function resolveSortDirection(
  field: string,
  sortDirection: string | null | undefined,
  entity: GoogleAdsMetricEntity,
  metricItems: MetricCatalogItem[],
): "asc" | "desc" {
  if (sortDirection === "asc" || sortDirection === "desc") return sortDirection;
  return defaultSortDirectionForKind(getSortColumnKind(field, entity, metricItems));
}

export function parseStoredSort(
  sortField: string | null | undefined,
  sortDirection: string | null | undefined,
  options: SortColumnOption[],
  entity: GoogleAdsMetricEntity,
  metricItems: MetricCatalogItem[],
): GoogleAdsMetricsSort {
  if (sortField && options.some((o) => o.key === sortField)) {
    return {
      field: sortField,
      direction: resolveSortDirection(sortField, sortDirection, entity, metricItems),
    };
  }
  if (sortField) {
    return fallbackSortWhenFieldRemoved(options, entity, metricItems);
  }
  return defaultSortForOptions(options, entity, metricItems);
}
