import { SYNCKERJA_LEADS_METRICS_API } from "../googleAdsSynckerjaLeadsMetrics.ts";
import { SYNCKERJA_TRAFFIC_METRICS_API } from "../googleAdsSynckerjaTrafficMetrics.ts";
import { METRIC_CATALOG } from "./metricsData.ts";
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  DEFAULT_METRIC_KEYS,
  IDENTITY_COLUMNS_API,
  KEYWORD_VIEW_EXCLUDED_METRIC_KEYS,
  MAX_METRICS_PER_REQUEST,
  RECOMMENDED_METRIC_KEYS,
  type MetricEntity,
} from "./types.ts";

export function getMetricCatalog(entity?: MetricEntity) {
  if (!entity) return [...METRIC_CATALOG];
  const defs = METRIC_CATALOG.filter((m) => m.entities.includes(entity));
  if (entity === "keyword") {
    return defs.filter((m) => !KEYWORD_VIEW_EXCLUDED_METRIC_KEYS.has(m.key));
  }
  return defs;
}

export function getMetricCatalogForApi(entity?: MetricEntity) {
  const defs = getMetricCatalog(entity);
  const defaultSet = new Set<string>(DEFAULT_METRIC_KEYS);
  const resolvedEntity = entity ?? "campaign";
  const recommendedSet = new Set(RECOMMENDED_METRIC_KEYS[resolvedEntity]);

  const recommendedMetrics = defs
    .filter((m) => recommendedSet.has(m.key) || m.recommendedFor?.includes(resolvedEntity))
    .map((m) => ({
      key: m.key,
      label: m.label,
      description: m.description,
      entities: m.entities,
      valueKind: m.valueKind,
      defaultSelected: defaultSet.has(m.key),
      sortable: m.sortable,
    }));

  return {
    max_metrics: MAX_METRICS_PER_REQUEST,
    identity_columns: entity ? IDENTITY_COLUMNS_API[entity] : IDENTITY_COLUMNS_API.campaign,
    recommended_keys: entity ? RECOMMENDED_METRIC_KEYS[entity] : RECOMMENDED_METRIC_KEYS.campaign,
    recommended: {
      id: "recommended",
      label: "Recommended columns",
      metrics: recommendedMetrics,
    },
    categories: [
      ...(resolvedEntity === "campaign"
        ? [
            {
              id: "synckerja_metrics",
              label: "Synckerja metrics",
              metrics: [...SYNCKERJA_TRAFFIC_METRICS_API, ...SYNCKERJA_LEADS_METRICS_API].map((m) => ({
                key: m.key,
                label: m.label,
                description: m.description,
                entities: [...m.entities],
                valueKind: m.valueKind,
                defaultSelected: false,
                sortable: m.sortable,
              })),
            },
          ]
        : []),
      ...CATEGORY_ORDER.map((id) => ({
        id,
        label: CATEGORY_LABELS[id],
        metrics: defs
          .filter((m) => m.category === id)
          .map((m) => ({
            key: m.key,
            label: m.label,
            description: m.description,
            entities: m.entities,
            valueKind: m.valueKind,
            defaultSelected: defaultSet.has(m.key),
            sortable: m.sortable,
          })),
      })).filter((c) => c.metrics.length > 0),
    ],
  };
}
