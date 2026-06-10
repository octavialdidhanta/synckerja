import { useMemo } from "react";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import type { TikTokAdsMetricEntity } from "@/tiktok-ads/hooks/useTikTokAdsMetricsQuery";
import type { TikTokAdsMetricsRow } from "@/tiktok-ads/hooks/useTikTokAdsMetricsQuery";
import type { TikTokAdsMetricCatalogItem } from "@/tiktok-ads/metrics/tiktokAdsMetricCatalog";
import {
  TIKTOK_ADS_SUMMARY_SLOT_COUNT,
  buildTikTokAdsSummaryMetricOptions,
  buildTikTokAdsSummaryTotals,
  tiktokAdsSummaryValidKeys,
  normalizeTikTokAdsSummarySlotKeys,
  type TikTokAdsTableMetricKey,
} from "@/tiktok-ads/metrics/tiktokAdsSummaryMetrics";
import { TikTokAdsSummaryMetricPicker } from "@/6-0-tiktok-ads/components/TikTokAdsSummaryMetricPicker";

type Summary = {
  spend: number;
  impressions: number;
  clicks: number;
  reach?: number;
  currency: string;
};

type Props = {
  entity: TikTokAdsMetricEntity;
  summary: Summary | null | undefined;
  rows: TikTokAdsMetricsRow[];
  catalogItems: TikTokAdsMetricCatalogItem[];
  metricKeys: TikTokAdsTableMetricKey[];
  onMetricKeysChange: (keys: TikTokAdsTableMetricKey[]) => void;
  isLoading?: boolean;
};

export function TikTokAdsMetricsSummaryBar({
  entity,
  summary,
  rows,
  catalogItems,
  metricKeys,
  onMetricKeysChange,
  isLoading = false,
}: Props) {
  const { t } = useAppTranslation();

  const metricOptions = useMemo(
    () =>
      buildTikTokAdsSummaryMetricOptions({
        entity,
        catalogItems,
        labels: {
          performance: t(
            "digitalMarketing.tiktokAds.summaryMetricGroupPerformance",
            "Performance",
          ),
          attribution: t(
            "digitalMarketing.tiktokAds.summaryMetricGroupAttribution",
            "Attribution",
          ),
          spend: t("digitalMarketing.tiktokAds.summaryCost", "Cost"),
          impressions: t("digitalMarketing.tiktokAds.impressions", "Impressions"),
          clicks: t("digitalMarketing.tiktokAds.clicks", "Clicks"),
          ctr: t("digitalMarketing.tiktokAds.ctr", "CTR"),
          cpc: t("digitalMarketing.tiktokAds.cpc", "CPC"),
          cpm: t("digitalMarketing.tiktokAds.cpm", "CPM"),
          reach: t("digitalMarketing.tiktokAds.reach", "Reach"),
          cpa: t("digitalMarketing.tiktokAds.columnCostPerLead", "CPA"),
          convertedLeads: t("digitalMarketing.tiktokAds.columnConvertedLeads", "Conv. leads"),
        },
      }),
    [entity, catalogItems, t],
  );

  const totals = useMemo(
    () => buildTikTokAdsSummaryTotals(summary, rows, entity),
    [summary, rows, entity],
  );

  const validKeys = useMemo(() => tiktokAdsSummaryValidKeys(entity), [entity]);

  const slots = useMemo(
    () => normalizeTikTokAdsSummarySlotKeys(metricKeys, validKeys, entity),
    [metricKeys, validKeys, entity],
  );

  if (isLoading) {
    return (
      <div
        className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5"
        aria-busy="true"
        aria-label={t("digitalMarketing.tiktokAds.summaryLoading", "Loading summary metrics")}
      >
        {Array.from({ length: TIKTOK_ADS_SUMMARY_SLOT_COUNT }, (_, i) => (
          <div key={i} className="rounded-md border border-gray-200 bg-white px-3 py-2">
            <Skeleton className="mb-1.5 h-3 w-16" />
            <Skeleton className="h-5 w-24" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {slots.map((key, index) => (
        <TikTokAdsSummaryMetricPicker
          key={index}
          selectedKey={key}
          onSelectKey={(nextKey) => {
            const next = normalizeTikTokAdsSummarySlotKeys(
              slots.map((k, i) => (i === index ? nextKey : k)),
              validKeys,
              entity,
            );
            onMetricKeysChange(next);
          }}
          options={metricOptions}
          totals={totals}
          isLoading={isLoading}
          searchPlaceholder={t(
            "digitalMarketing.tiktokAds.summarySearchMetrics",
            "Search metrics…",
          )}
          emptyLabel={t("digitalMarketing.tiktokAds.summaryNoMetrics", "No metrics found.")}
        />
      ))}
    </div>
  );
}
