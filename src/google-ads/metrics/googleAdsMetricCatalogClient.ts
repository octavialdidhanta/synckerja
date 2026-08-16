import {
  GOOGLE_ADS_IDENTITY_COLUMNS,
  isGoogleAdsPinnedMetricKey,
} from "@/google-ads/metrics/googleAdsIdentityColumns";
import { SYNCKERJA_LEADS_METRIC_ITEMS } from "@/google-ads/metrics/googleAdsSynckerjaLeadsMetrics";
import { SYNCKERJA_TRAFFIC_METRIC_ITEMS } from "@/google-ads/metrics/googleAdsSynckerjaTrafficMetrics";
import { METRIC_CATALOG } from "@/google-ads/metrics/googleAdsMetricsData";
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  KEYWORD_VIEW_EXCLUDED_METRIC_KEYS,
  RECOMMENDED_METRIC_KEYS,
  type MetricEntity,
} from "@/google-ads/metrics/googleAdsMetricsCatalogTypes";
import type {
  GoogleAdsMetricCatalogResponse,
  GoogleAdsMetricEntity,
  MetricCatalogItem,
} from "@/google-ads/metrics/types";
import { DEFAULT_METRIC_KEYS, GOOGLE_ADS_MAX_METRICS } from "@/google-ads/metrics/types";

function getMetricCatalog(entity?: MetricEntity) {
  if (!entity) return [...METRIC_CATALOG];
  const defs = METRIC_CATALOG.filter((m) => m.entities.includes(entity));
  if (entity === "keyword") {
    return defs.filter((m) => !KEYWORD_VIEW_EXCLUDED_METRIC_KEYS.has(m.key));
  }
  return defs;
}

function toCatalogItem(m: (typeof METRIC_CATALOG)[number]): MetricCatalogItem {
  return {
    key: m.key,
    label: m.label,
    description: m.description,
    entities: [...m.entities],
    valueKind: m.valueKind,
    defaultSelected: DEFAULT_METRIC_KEYS.includes(m.key as (typeof DEFAULT_METRIC_KEYS)[number]),
    sortable: m.sortable,
  };
}

/** Full metric catalog built locally — does not require edge function. */
export function buildGoogleAdsMetricCatalogClient(
  entity: GoogleAdsMetricEntity,
): GoogleAdsMetricCatalogResponse {
  const defs = getMetricCatalog(entity);
  const defaultSet = new Set<string>(DEFAULT_METRIC_KEYS);
  const recommendedSet = new Set(RECOMMENDED_METRIC_KEYS[entity]);

  const recommendedMetrics = defs
    .filter((m) => !isGoogleAdsPinnedMetricKey(m.key))
    .filter((m) => recommendedSet.has(m.key) || m.recommendedFor?.includes(entity))
    .map(toCatalogItem);

  const synckerjaMetrics: MetricCatalogItem[] =
    entity === "campaign"
      ? [...SYNCKERJA_TRAFFIC_METRIC_ITEMS, ...SYNCKERJA_LEADS_METRIC_ITEMS].map((m) => ({
          key: m.key,
          label: m.label,
          description: m.description,
          entities: [...m.entities],
          valueKind: m.valueKind,
          defaultSelected: false,
          sortable: m.sortable,
        }))
      : [];

  const categories = [
    ...(synckerjaMetrics.length > 0
      ? [{ id: "synckerja_metrics", label: "Synckerja metrics", metrics: synckerjaMetrics }]
      : []),
    ...CATEGORY_ORDER.map((id) => ({
      id,
      label: CATEGORY_LABELS[id],
      metrics: defs
        .filter((m) => m.category === id && !isGoogleAdsPinnedMetricKey(m.key))
        .map(toCatalogItem),
    })).filter((c) => c.metrics.length > 0),
  ];

  return {
    max_metrics: GOOGLE_ADS_MAX_METRICS,
    identity_columns: GOOGLE_ADS_IDENTITY_COLUMNS[entity].map((c) => ({
      key: c.key,
      label: c.label,
    })),
    recommended_keys: RECOMMENDED_METRIC_KEYS[entity],
    recommended: {
      id: "recommended",
      label: "Recommended columns",
      metrics: recommendedMetrics,
    },
    categories,
  };
}
