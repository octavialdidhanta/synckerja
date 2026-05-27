export type GoogleAdsMetricEntity = "campaign" | "ad_group" | "ad";

export type MetricValueKind = "micros" | "rate" | "count" | "fraction";

export type MetricCatalogItem = {
  key: string;
  label: string;
  description: string;
  entities: GoogleAdsMetricEntity[];
  valueKind: MetricValueKind;
  defaultSelected: boolean;
  sortable?: boolean;
};

export type GoogleAdsMetricsSort = {
  field: string;
  direction: "asc" | "desc";
};

export type MetricCatalogCategory = {
  id: string;
  label: string;
  metrics: MetricCatalogItem[];
};

export const DEFAULT_METRIC_KEYS = ["impressions", "clicks", "ctr", "spent"] as const;

export type GoogleAdsMetricsRow = {
  id: string;
  identity: Record<string, unknown>;
  metrics: Record<string, number | null>;
};

export type GoogleAdsMetricsResponse = {
  customer_id: string;
  currency_code: string | null;
  entity: GoogleAdsMetricEntity;
  date_range: { start: string; end: string };
  rows: GoogleAdsMetricsRow[];
  next_page_token: string | null;
  fetched_at: string;
  cached?: boolean;
  error?: string;
  code?: string;
  unsupported_metrics?: string[];
};
