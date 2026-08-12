import { useMemo } from "react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { useMetaAdsReportTargetProgress } from "@/6-0-digital-marketing-shared/hooks/useMetaAdsReportTargetProgress";
import { formatMetaMetricValue } from "@/meta-ads/metrics/formatMetaMetricValue";
import type { MetaAdsMetricEntity } from "@/meta-ads/hooks/useMetaAdsMetricsQuery";
import type { MetaAdsMetricsRow } from "@/meta-ads/hooks/useMetaAdsMetricsQuery";
import type { MetaAdsMetricCatalogItem } from "@/meta-ads/metrics/metaAdsMetricCatalog";
import {
  META_ADS_SUMMARY_SLOT_COUNT,
  buildMetaAdsSummaryMetricOptions,
  buildMetaAdsSummaryTotals,
  formatMetaAdsSummaryMetricValue,
  metaAdsSummaryValidKeys,
  normalizeMetaAdsSummarySlotKeys,
  type MetaAdsTableMetricKey,
} from "@/meta-ads/metrics/metaAdsSummaryMetrics";
import { MobileMetaAdsSummaryMetricCard } from "@/mobile/6-0-meta-ads/components/MobileMetaAdsSummaryMetricCard";
import type { DmReportTargetProgress } from "@/6-0-digital-marketing-shared/dmReportTargetTypes";

type Summary = {
  spend: number;
  impressions: number;
  clicks: number;
  reach?: number;
  currency: string;
};

type Props = {
  entity: MetaAdsMetricEntity;
  adAccountId: string | null;
  summary: Summary | null | undefined;
  rows: MetaAdsMetricsRow[];
  catalogItems: MetaAdsMetricCatalogItem[];
  metricKeys: MetaAdsTableMetricKey[];
  onMetricKeysChange: (keys: MetaAdsTableMetricKey[]) => void;
  isLoading?: boolean;
};

function formatProgressRatio(
  tableKey: MetaAdsTableMetricKey,
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
      return formatMetaMetricValue("ctr", v, currency, { ctrSource: "computed" });
    }
    if (tableKey === "service_cpl") {
      return formatMetaMetricValue("service_cpl", v, currency);
    }
    if (tableKey === "service_converted_leads") {
      return formatMetaMetricValue("service_converted_leads", v, currency);
    }
    return formatMetaMetricValue(tableKey, v, currency);
  };
  return `${fmt(progress.actual)} / ${fmt(progress.target)}`;
}

export function MobileMetaAdsSummaryBar({
  entity,
  adAccountId,
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

  const { progressByTableMetric, targetsLoading } = useMetaAdsReportTargetProgress({
    adAccountId,
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
        aria-label={t("digitalMarketing.metaAds.summaryLoading", "Loading summary metrics")}
      >
        {Array.from({ length: 1 + META_ADS_SUMMARY_SLOT_COUNT }, (_, i) => (
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
      <MobileMetaAdsSummaryMetricCard
        selectedKey="spend"
        onSelectKey={() => {}}
        options={metricOptions}
        totals={totals}
        isLoading={isLoading}
        fixedLabel={t("digitalMarketing.metaAds.summaryCost", "Cost")}
        fixedValue={formatMetaAdsSummaryMetricValue("spend", totals)}
        targetProgress={costProgress}
        targetsLoading={targetsLoading}
        progressRatioText={formatProgressRatio("spend", costProgress, currencyCode)}
      />
      {slots.map((key, index) => {
        const progress = progressByTableMetric.get(key);
        return (
          <MobileMetaAdsSummaryMetricCard
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
