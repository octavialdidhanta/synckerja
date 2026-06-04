import type { GoogleAdsMetricEntity } from "@/google-ads/metrics/types";

export type GoogleAdsIdentityColumnDef = {
  key: string;
  label: string;
};

export const GOOGLE_ADS_IDENTITY_COLUMNS: Record<
  GoogleAdsMetricEntity,
  GoogleAdsIdentityColumnDef[]
> = {
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

export const GOOGLE_ADS_RECOMMENDED_METRIC_KEYS: Record<GoogleAdsMetricEntity, string[]> = {
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

export const GOOGLE_ADS_MAX_METRICS = 50;

export function modifyColumnsTitle(entity: GoogleAdsMetricEntity): string {
  const labels: Record<GoogleAdsMetricEntity, string> = {
    campaign: "campaigns",
    ad_group: "ad groups",
    ad: "ads",
    keyword: "keywords",
  };
  return `Modify columns for ${labels[entity]}`;
}
