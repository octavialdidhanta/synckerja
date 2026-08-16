import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { useGoogleAdsReportTargetProgress } from "@/6-0-digital-marketing-shared/hooks/useGoogleAdsReportTargetProgress";
import {
  googleAdsPeriodCompareBits,
  useGoogleAdsSummaryPeriodCompare,
} from "@/6-0-google-ads/hooks/useGoogleAdsSummaryPeriodCompare";
import { SUMMARY_SLOT_COUNT } from "@/google-ads/metrics/googleAdsSummaryMetricOptions";
import { formatMetricValue } from "@/google-ads/metrics/formatMetricValue";
import { findSummaryMetricOption } from "@/google-ads/metrics/googleAdsSummaryMetricOptions";
import type { GoogleAdsMetricsFilters } from "@/google-ads/hooks/useGoogleAdsMetricsQuery";
import type {
  GoogleAdsMetricsSummaryTotals,
  GoogleAdsSummaryMetricOption,
} from "@/google-ads/metrics/types";
import { MobileGoogleAdsSummaryMetricCard } from "@/mobile/6-0-google-ads/components/MobileGoogleAdsSummaryMetricCard";

type Props = {
  customerId: string | null;
  totals: GoogleAdsMetricsSummaryTotals | null | undefined;
  currencyCode: string | null;
  isLoading?: boolean;
  metricKeys: string[];
  onMetricKeyChange: (slotIndex: number, key: string) => void;
  summaryMetricOptions: GoogleAdsSummaryMetricOption[];
  organizationId?: string | null;
  metricsFilters?: GoogleAdsMetricsFilters | null;
  compareEnabled?: boolean;
};

function costValue(
  totals: GoogleAdsMetricsSummaryTotals | null | undefined,
  currencyCode: string | null,
): string {
  if (!totals) return "—";
  const spent =
    totals.by_key && "spent" in totals.by_key
      ? totals.by_key.spent
      : totals.spent;
  return formatMetricValue("spent", spent ?? null, currencyCode, "micros");
}

function progressRatioTextForCatalogKey(
  catalogKey: string,
  progress: {
    showProgress: boolean;
    target: number | null;
    actual: number | null;
  } | undefined,
  currencyCode: string | null,
  valueKind: GoogleAdsSummaryMetricOption["valueKind"],
): string | null {
  if (
    !progress?.showProgress ||
    progress.target == null ||
    progress.target <= 0 ||
    progress.actual == null
  ) {
    return null;
  }
  return `${formatMetricValue(catalogKey, progress.actual, currencyCode, valueKind)} / ${formatMetricValue(catalogKey, progress.target, currencyCode, valueKind)}`;
}

/**
 * Full-bleed mobile summary bar (Cost + selectable metric slots).
 * Uses shared slot keys / options / totals — not desktop summary UI components.
 */
export function MobileGoogleAdsSummaryBar({
  customerId,
  totals,
  currencyCode,
  isLoading,
  metricKeys,
  onMetricKeyChange,
  summaryMetricOptions,
  organizationId = null,
  metricsFilters = null,
  compareEnabled = false,
}: Props) {
  const { t } = useTranslation();
  const slots = metricKeys.slice(0, SUMMARY_SLOT_COUNT);

  const catalogMetricKeys = useMemo(() => ["spent", ...slots], [slots]);

  const { progressByCatalogKey, targetsLoading } = useGoogleAdsReportTargetProgress({
    customerId,
    googleTotals: totals,
    catalogMetricKeys,
  });

  const { previousRange, previousTotals, compareLoading, compareError } = useGoogleAdsSummaryPeriodCompare({
    organizationId,
    filters: metricsFilters,
    enabled: compareEnabled,
  });

  if (isLoading) {
    return (
      <div
        className="-mx-2 grid grid-cols-2 gap-px overflow-hidden border-y border-border bg-border"
        aria-busy="true"
        aria-label={t("digitalMarketing.googleAds.summaryLoading", "Loading summary metrics")}
      >
        {Array.from({ length: 1 + SUMMARY_SLOT_COUNT }, (_, i) => (
          <div key={i} className="bg-card px-4 py-3">
            <Skeleton className="mb-1.5 h-3 w-16" />
            <Skeleton className="h-6 w-24" />
            <Skeleton className="mt-0.5 h-3 w-20" />
            <Skeleton className="mt-2 h-1.5 w-full" />
          </div>
        ))}
      </div>
    );
  }

  const costProgress = progressByCatalogKey.get("spent");
  const costCompare = googleAdsPeriodCompareBits({
    metricKey: "spent",
    valueKind: "micros",
    currentTotals: totals,
    previousTotals,
    previousRange,
    compareLoading,
    compareError,
    currencyCode,
  });

  return (
    <div className="-mx-2 grid grid-cols-2 gap-px overflow-hidden border-y border-border bg-border">
      <MobileGoogleAdsSummaryMetricCard
        selectedKey="spent"
        onSelectKey={() => {}}
        options={summaryMetricOptions}
        totals={totals}
        currencyCode={currencyCode}
        isLoading={isLoading}
        fixedLabel={t("digitalMarketing.googleAds.summaryCostFixed", "Cost")}
        fixedValue={costValue(totals, currencyCode)}
        targetProgress={costProgress}
        targetsLoading={targetsLoading}
        progressRatioText={progressRatioTextForCatalogKey(
          "spent",
          costProgress,
          currencyCode,
          "micros",
        )}
        {...costCompare}
      />
      {slots.map((key, index) => {
        const selected = findSummaryMetricOption(summaryMetricOptions, key);
        const valueKind = selected?.valueKind ?? "count";
        const progress = progressByCatalogKey.get(key);
        const slotCompare = googleAdsPeriodCompareBits({
          metricKey: key,
          valueKind,
          currentTotals: totals,
          previousTotals,
          previousRange,
          compareLoading,
          compareError,
          currencyCode,
        });

        return (
          <MobileGoogleAdsSummaryMetricCard
            key={index}
            selectedKey={key}
            onSelectKey={(nextKey) => onMetricKeyChange(index, nextKey)}
            options={summaryMetricOptions}
            totals={totals}
            currencyCode={currencyCode}
            isLoading={isLoading}
            targetProgress={progress}
            targetsLoading={targetsLoading}
            progressRatioText={progressRatioTextForCatalogKey(
              key,
              progress,
              currencyCode,
              valueKind,
            )}
            {...slotCompare}
          />
        );
      })}
    </div>
  );
}
