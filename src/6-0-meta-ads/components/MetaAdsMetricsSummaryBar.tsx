import { useMemo } from "react";
import { useMetaAdsReportTargetProgress } from "@/6-0-digital-marketing-shared/hooks/useMetaAdsReportTargetProgress";
import { formatMetaAdsTargetProgressRatio } from "@/6-0-digital-marketing-shared/metaAdsPageTargetProgress";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import type { MetaAdsAccountSummary, MetaAdsMetricEntity } from "@/meta-ads/hooks/useMetaAdsMetricsQuery";
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
import {
  metaAdsPeriodCompareBits,
  useMetaAdsSummaryPeriodCompare,
} from "@/6-0-meta-ads/hooks/useMetaAdsSummaryPeriodCompare";

type Props = {
  entity: MetaAdsMetricEntity;
  adAccountId: string | null;
  summary: MetaAdsAccountSummary | null | undefined;
  rows: MetaAdsMetricsRow[];
  catalogItems: MetaAdsMetricCatalogItem[];
  metricKeys: MetaAdsTableMetricKey[];
  onMetricKeysChange: (keys: MetaAdsTableMetricKey[]) => void;
  isLoading?: boolean;
  organizationId?: string | null;
  dateStart?: string | null;
  dateEnd?: string | null;
  compareEnabled?: boolean;
};

export function MetaAdsMetricsSummaryBar({
  entity,
  adAccountId,
  summary,
  rows,
  catalogItems,
  metricKeys,
  onMetricKeysChange,
  isLoading = false,
  organizationId = null,
  dateStart = null,
  dateEnd = null,
  compareEnabled = false,
}: Props) {
  const { t } = useAppTranslation();

  const metricOptions = useMemo(
    () =>
      buildMetaAdsSummaryMetricOptions({
        entity,
        catalogItems: catalogItems.map((item) => ({
          ...item,
          defaultLabel: t(item.labelKey, item.defaultLabel),
        })),
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

  const { progressByTableMetric, targetsLoading } = useMetaAdsReportTargetProgress({
    adAccountId,
    summary: summary ?? null,
    rows,
    tableMetricKeys: slots,
  });

  const currencyCode = summary?.currency ?? "IDR";

  const { previousRange, previousTotals, compareLoading, compareError } =
    useMetaAdsSummaryPeriodCompare({
      organizationId,
      adAccountId,
      entity,
      dateStart,
      dateEnd,
      enabled: compareEnabled,
    });

  const gridClass =
    slots.length <= 4
      ? "grid grid-cols-2 gap-2 lg:grid-cols-4"
      : "grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5";

  if (isLoading) {
    return (
      <div
        className={gridClass}
        aria-busy="true"
        aria-label={t("digitalMarketing.metaAds.summaryLoading", "Loading summary metrics")}
      >
        {Array.from({ length: slots.length || META_ADS_SUMMARY_SLOT_COUNT }, (_, i) => (
          <div key={i} className="rounded-md border border-gray-200 bg-white px-3 py-2">
            <Skeleton className="mb-1.5 h-3 w-16" />
            <Skeleton className="h-5 w-24" />
            <Skeleton className="mt-0.5 h-3 w-20" />
            <Skeleton className="mt-2 h-1.5 w-full" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={gridClass}>
      {slots.map((key, index) => {
        const progress = progressByTableMetric.get(key);
        const slotCompare = metaAdsPeriodCompareBits({
          metricKey: key,
          currentTotals: totals,
          previousTotals,
          previousRange,
          compareLoading,
          compareError,
        });
        return (
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
            targetProgress={progress}
            targetsLoading={targetsLoading}
            progressRatioText={formatMetaAdsTargetProgressRatio(key, progress, currencyCode)}
            {...slotCompare}
          />
        );
      })}
    </div>
  );
}
