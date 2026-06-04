export type MetricEntity = "campaign" | "ad_group" | "ad" | "keyword";

export type MetricCategory =
  | "performance"
  | "conversions"
  | "attribution"
  | "attributes"
  | "bid_simulator"
  | "competitive"
  | "viewability"
  | "quality_score"
  | "call_details"
  | "message_details"
  | "gmail";

export type MetricValueKind = "micros" | "rate" | "count" | "fraction";

export type MetricDef = {
  key: string;
  label: string;
  category: MetricCategory;
  gaqlField: string;
  valueKind: MetricValueKind;
  entities: MetricEntity[];
  sortable: boolean;
  description: string;
  recommendedFor?: MetricEntity[];
};

export const ALL_ENTITIES: MetricEntity[] = ["campaign", "ad_group", "ad", "keyword"];

export const DEFAULT_METRIC_KEYS = ["impressions", "clicks", "ctr", "spent"] as const;

export const MAX_METRICS_PER_REQUEST = 50;

export const KEYWORD_VIEW_EXCLUDED_METRIC_KEYS = new Set<string>([
  "invalid_clicks",
  "invalid_click_rate",
  "avg_cpv",
]);

export const CATEGORY_ORDER: MetricCategory[] = [
  "performance",
  "conversions",
  "attribution",
  "attributes",
  "bid_simulator",
  "competitive",
  "viewability",
  "quality_score",
  "call_details",
  "message_details",
  "gmail",
];

export const CATEGORY_LABELS: Record<MetricCategory, string> = {
  performance: "Performance",
  conversions: "Conversions",
  attribution: "Attribution",
  attributes: "Attributes",
  bid_simulator: "Bid simulator",
  competitive: "Competitive metrics",
  viewability: "Viewability",
  quality_score: "Quality score",
  call_details: "Call details",
  message_details: "Message details",
  gmail: "Gmail",
};

export type IdentityColumnApi = { key: string; label: string };

export const IDENTITY_COLUMNS_API: Record<MetricEntity, IdentityColumnApi[]> = {
  keyword: [
    { key: "keyword", label: "Keyword" },
    { key: "match_type", label: "Match type" },
    { key: "campaign", label: "Campaign" },
    { key: "ad_group", label: "Ad group" },
    { key: "status", label: "Status" },
  ],
  campaign: [
    { key: "service", label: "Service" },
    { key: "service_cpl", label: "CPA" },
    { key: "service_converted_leads", label: "Conv. leads" },
    { key: "name", label: "Campaign" },
    { key: "status", label: "Status" },
    { key: "channel", label: "Type" },
  ],
  ad_group: [
    { key: "name", label: "Ad group" },
    { key: "campaign", label: "Campaign" },
    { key: "status", label: "Status" },
  ],
  ad: [
    { key: "preview", label: "Ad" },
    { key: "status", label: "Status" },
  ],
};

export const RECOMMENDED_METRIC_KEYS: Record<MetricEntity, string[]> = {
  keyword: [
    "clicks",
    "conv_rate",
    "conversions",
    "avg_cpc",
    "cost_per_conv",
    "impressions",
    "ctr",
    "spent",
  ],
  campaign: [
    "impressions",
    "clicks",
    "ctr",
    "spent",
    "conversions",
    "conv_rate",
    "avg_cpc",
    "cost_per_conv",
  ],
  ad_group: [
    "impressions",
    "clicks",
    "ctr",
    "spent",
    "conversions",
    "conv_rate",
    "avg_cpc",
    "cost_per_conv",
  ],
  ad: ["impressions", "clicks", "ctr", "spent", "conversions", "conv_rate"],
};
