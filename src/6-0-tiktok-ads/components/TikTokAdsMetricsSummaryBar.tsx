import { useMemo } from "react";
import { useTikTokAdsReportTargetProgress } from "@/6-0-digital-marketing-shared/hooks/useTikTokAdsReportTargetProgress";
import type { DmReportTargetProgress } from "@/6-0-digital-marketing-shared/dmReportTargetTypes";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { formatTikTokMetricValue } from "@/tiktok-ads/metrics/formatTikTokMetricValue";
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
  advertiserId: string | null;
  summary: Summary | null | undefined;
  rows: TikTokAdsMetricsRow[];
  catalogItems: TikTokAdsMetricCatalogItem[];
  metricKeys: TikTokAdsTableMetricKey[];
  onMetricKeysChange: (keys: TikTokAdsTableMetricKey[]) => void;
  isLoading?: boolean;
};

function formatTikTokProgressRatioValue(
  tableKey: TikTokAdsTableMetricKey,
  value: number,
  currency: string,
): string {
  if (tableKey === "ctr") {
    return formatTikTokMetricValue("ctr", value, currency, { ctrSource: "computed" });
  }
  if (tableKey === "service_cpl") {
    return formatTikTokMetricValue("service_cpl", value, currency);
  }
  if (tableKey === "service_converted_leads") {
    return formatTikTokMetricValue("service_converted_leads", value, currency);
  }
  return formatTikTokMetricValue(tableKey, value, currency);
}

function progressRatioTextForTableKey(
  tableKey: TikTokAdsTableMetricKey,
  progress: DmReportTargetProgress | undefined,
  currency: string,
): string | null {
  if (
    !progress?.showProgress ||
    progress.target == null ||
    progress.target <= 0 ||
    progress.actual == null
  ) {
    return null;
  }
  return `${formatTikTokProgressRatioValue(tableKey, progress.actual, currency)} / ${formatTikTokProgressRatioValue(tableKey, progress.target, currency)}`;
}

export function TikTokAdsMetricsSummaryBar({
  entity,
  advertiserId,
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

  const { progressByTableMetric, targetsLoading } = useTikTokAdsReportTargetProgress({
    advertiserId,
    summary: summary ?? null,
    rows,
    tableMetricKeys: slots,
  });

  const currencyCode = summary?.currency ?? "IDR";

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
            <Skeleton className="mt-2 h-1.5 w-full" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {slots.map((key, index) => {
        const progress = progressByTableMetric.get(key);
        return (
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
            targetProgress={progress}
            targetsLoading={targetsLoading}
            progressRatioText={progressRatioTextForTableKey(key, progress, currencyCode)}
          />
        );
      })}
    </div>
  );
}
