import { useMemo } from "react";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import type { MetaAdsMetricEntity } from "@/meta-ads/hooks/useMetaAdsMetricsQuery";
import type { MetaAdsMetricsRow } from "@/meta-ads/hooks/useMetaAdsMetricsQuery";
import type { MetaAdsMetricCatalogItem } from "@/meta-ads/metrics/metaAdsMetricCatalog";
import {
  META_ADS_SUMMARY_SLOT_COUNT,
  buildMetaAdsSummaryMetricOptions,
  buildMetaAdsSummaryTotals,
  metaAdsSummaryValidKeys,
  normalizeMetaAdsSummarySlotKeys,
  type MetaAdsTableMetricKey,
} from "@/meta-ads/metrics/metaAdsSummaryMetrics";
import { MetaAdsSummaryMetricPicker } from "@/6-0-meta-ads/components/MetaAdsSummaryMetricPicker";

type Summary = {
  spend: number;
  impressions: number;
  clicks: number;
  reach?: number;
  currency: string;
};

type Props = {
  entity: MetaAdsMetricEntity;
  summary: Summary | null | undefined;
  rows: MetaAdsMetricsRow[];
  catalogItems: MetaAdsMetricCatalogItem[];
  metricKeys: MetaAdsTableMetricKey[];
  onMetricKeysChange: (keys: MetaAdsTableMetricKey[]) => void;
  isLoading?: boolean;
};

export function MetaAdsMetricsSummaryBar({
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
      buildMetaAdsSummaryMetricOptions({
        entity,
        catalogItems,
        labels: {
          performance: t(
            "digitalMarketing.metaAds.summaryMetricGroupPerformance",
            "Performance",
          ),
          attribution: t(
            "digitalMarketing.metaAds.summaryMetricGroupAttribution",
            "Attribution",
          ),
          spend: t("digitalMarketing.metaAds.summaryCost", "Cost"),
          impressions: t("digitalMarketing.metaAds.impressions", "Impressions"),
          clicks: t("digitalMarketing.metaAds.clicks", "Clicks"),
          ctr: t("digitalMarketing.metaAds.ctr", "CTR"),
          cpc: t("digitalMarketing.metaAds.cpc", "CPC"),
          cpm: t("digitalMarketing.metaAds.cpm", "CPM"),
          reach: t("digitalMarketing.metaAds.reach", "Reach"),
          cpa: t("digitalMarketing.metaAds.columnCostPerLead", "CPA"),
          convertedLeads: t("digitalMarketing.metaAds.columnConvertedLeads", "Conv. leads"),
        },
      }),
    [entity, catalogItems, t],
  );

  const totals = useMemo(
    () => buildMetaAdsSummaryTotals(summary, rows, entity),
    [summary, rows, entity],
  );

  const validKeys = useMemo(() => metaAdsSummaryValidKeys(entity), [entity]);

  const slots = useMemo(
    () => normalizeMetaAdsSummarySlotKeys(metricKeys, validKeys, entity),
    [metricKeys, validKeys, entity],
  );

  if (isLoading) {
    return (
      <div
        className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5"
        aria-busy="true"
        aria-label={t("digitalMarketing.metaAds.summaryLoading", "Loading summary metrics")}
      >
        {Array.from({ length: META_ADS_SUMMARY_SLOT_COUNT }, (_, i) => (
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
        <MetaAdsSummaryMetricPicker
          key={index}
          selectedKey={key}
          onSelectKey={(nextKey) => {
            const next = normalizeMetaAdsSummarySlotKeys(
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
            "digitalMarketing.metaAds.summarySearchMetrics",
            "Search metrics…",
          )}
          emptyLabel={t("digitalMarketing.metaAds.summaryNoMetrics", "No metrics found.")}
        />
      ))}
    </div>
  );
}
