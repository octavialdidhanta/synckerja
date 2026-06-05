import type { GoogleAdsMetricEntity } from "@/google-ads/metrics/types";

export type MetricEntity = GoogleAdsMetricEntity;

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
