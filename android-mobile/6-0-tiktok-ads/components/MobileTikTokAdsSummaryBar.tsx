import { useMemo } from "react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { useTikTokAdsReportTargetProgress } from "@/6-0-digital-marketing-shared/hooks/useTikTokAdsReportTargetProgress";
import { formatTikTokMetricValue } from "@/tiktok-ads/metrics/formatTikTokMetricValue";
import type { TikTokAdsMetricEntity } from "@/tiktok-ads/hooks/useTikTokAdsMetricsQuery";
import type { TikTokAdsMetricsRow } from "@/tiktok-ads/hooks/useTikTokAdsMetricsQuery";
import type { TikTokAdsMetricCatalogItem } from "@/tiktok-ads/metrics/tiktokAdsMetricCatalog";
import {
  TIKTOK_ADS_SUMMARY_SLOT_COUNT,
  buildTikTokAdsSummaryMetricOptions,
  buildTikTokAdsSummaryTotals,
  formatTikTokAdsSummaryMetricValue,
  tiktokAdsSummaryValidKeys,
  normalizeTikTokAdsSummarySlotKeys,
  type TikTokAdsTableMetricKey,
} from "@/tiktok-ads/metrics/tiktokAdsSummaryMetrics";
import { MobileTikTokAdsSummaryMetricCard } from "@/mobile/6-0-tiktok-ads/components/MobileTikTokAdsSummaryMetricCard";
import type { DmReportTargetProgress } from "@/6-0-digital-marketing-shared/dmReportTargetTypes";

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

function formatProgressRatio(
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
  const fmt = (v: number) => {
    if (tableKey === "ctr") {
      return formatTikTokMetricValue("ctr", v, currency, { ctrSource: "computed" });
    }
    if (tableKey === "service_cpl") {
      return formatTikTokMetricValue("service_cpl", v, currency);
    }
    if (tableKey === "service_converted_leads") {
      return formatTikTokMetricValue("service_converted_leads", v, currency);
    }
    return formatTikTokMetricValue(tableKey, v, currency);
  };
  return `${fmt(progress.actual)} / ${fmt(progress.target)}`;
}

export function MobileTikTokAdsSummaryBar({
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
    tableMetricKeys: ["spend", ...slots.filter((k) => k !== "spend")],
  });

  const currencyCode = summary?.currency ?? "IDR";
  const pickerOptions = useMemo(
    () => metricOptions.filter((o) => o.key !== "spend"),
    [metricOptions],
  );

  if (isLoading) {
    return (
      <div
        className="-mx-2 grid grid-cols-2 gap-px overflow-hidden border-y border-border bg-border"
        aria-busy="true"
        aria-label={t("digitalMarketing.tiktokAds.summaryLoading", "Loading summary metrics")}
      >
        {Array.from({ length: 1 + TIKTOK_ADS_SUMMARY_SLOT_COUNT }, (_, i) => (
          <div key={i} className="bg-card px-4 py-3">
            <Skeleton className="mb-1.5 h-3 w-16" />
            <Skeleton className="h-6 w-24" />
            <Skeleton className="mt-2 h-1.5 w-full" />
          </div>
        ))}
      </div>
    );
  }

  const costProgress = progressByTableMetric.get("spend");

  return (
    <div className="-mx-2 grid grid-cols-2 gap-px overflow-hidden border-y border-border bg-border">
      <MobileTikTokAdsSummaryMetricCard
        selectedKey="spend"
        onSelectKey={() => {}}
        options={metricOptions}
        totals={totals}
        isLoading={isLoading}
        fixedLabel={t("digitalMarketing.tiktokAds.summaryCost", "Cost")}
        fixedValue={formatTikTokAdsSummaryMetricValue("spend", totals)}
        targetProgress={costProgress}
        targetsLoading={targetsLoading}
        progressRatioText={formatProgressRatio("spend", costProgress, currencyCode)}
      />
      {slots.map((key, index) => {
        const progress = progressByTableMetric.get(key);
        return (
          <MobileTikTokAdsSummaryMetricCard
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
            options={pickerOptions.length > 0 ? pickerOptions : metricOptions}
            totals={totals}
            isLoading={isLoading}
            targetProgress={progress}
            targetsLoading={targetsLoading}
            progressRatioText={formatProgressRatio(key, progress, currencyCode)}
          />
        );
      })}
    </div>
  );
}
