export type GoogleAdsMetricEntity = "campaign" | "ad_group" | "ad" | "keyword";

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

export type GoogleAdsIdentityColumn = {
  key: string;
  label: string;
};

/** Google Ads UI Custom column (formula) mirrored in Synckerja — not from Google Ads API. */
export type GoogleAdsUiCustomColumnItem = {
  key: string;
  label: string;
  description: string;
  column_id: string;
};

export type GoogleAdsUiCustomColumnsResponse = {
  custom_columns: GoogleAdsUiCustomColumnItem[];
  imported_count?: number;
};

export type GoogleAdsMetricCatalogResponse = {
  max_metrics: number;
  identity_columns: GoogleAdsIdentityColumn[];
  recommended_keys: string[];
  recommended: MetricCatalogCategory;
  categories: MetricCatalogCategory[];
};

export const DEFAULT_METRIC_KEYS = ["impressions", "clicks", "ctr", "spent"] as const;

export const GOOGLE_ADS_MAX_METRICS = 50;

export type GoogleAdsMetricsRow = {
  id: string;
  identity: Record<string, unknown>;
  metrics: Record<string, number | null>;
};

export type GoogleAdsMetricsSummaryTotals = {
  impressions: number;
  clicks: number;
  spent: number;
  /** Aggregate CTR = clicks / impressions (fraction); null when no impressions. */
  ctr: number | null;
  conversions: number;
  by_key: Record<string, number | null>;
};

export type GoogleAdsSummaryMetricOption = {
  key: string;
  label: string;
  valueKind: MetricValueKind;
  groupId: string;
  groupLabel: string;
};

export type GoogleAdsConversionActionOption = {
  key: string;
  label: string;
  description?: string;
};

export type GoogleAdsMetricsResponse = {
  customer_id: string;
  currency_code: string | null;
  entity: GoogleAdsMetricEntity;
  date_range: { start: string; end: string };
  rows: GoogleAdsMetricsRow[];
  next_page_token: string | null;
  /** Total rows for current filter (all pages), when server has full result set. */
  total_row_count?: number;
  /** Rows before Delivery (only_running) filter; present when that filter may hide rows. */
  total_row_count_before_delivery?: number;
  fetched_at: string;
  cached?: boolean;
  campaign_filter_id?: string | null;
  error?: string;
  code?: string;
  unsupported_metrics?: string[];
  /** KPI totals for the full filtered result set (all pages). */
  summary_totals?: GoogleAdsMetricsSummaryTotals;
};
