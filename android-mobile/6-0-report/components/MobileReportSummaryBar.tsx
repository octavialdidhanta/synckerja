import { useMemo, useState } from "react";
import { useDigitalMarketingReportData } from "@/6-0-digital-marketing-shared/DigitalMarketingReportDataContext";
import { formatDmActualValue } from "@/6-0-digital-marketing-shared/dmReportTargetActuals";
import { reportMetricValueKind } from "@/6-0-digital-marketing-shared/dmReportTargetMetricMapping";
import { useDmReportTargetProgress } from "@/6-0-digital-marketing-shared/hooks/useDmReportTargetProgress";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { Skeleton } from "@/shared/components/ui/skeleton";
import type {
  ReportGoogleServiceRow,
  ReportMetaServiceRow,
  ReportTikTokServiceRow,
} from "@/6-0-digital-marketing-shared/hooks/useDigitalMarketingReportCosts";
import { useDigitalMarketingReportFilteredRows } from "@/6-0-digital-marketing-shared/hooks/useDigitalMarketingReportFilteredRows";
import {
  REPORT_SUMMARY_METRIC_OPTIONS,
  REPORT_SUMMARY_MOBILE_DEFAULT_SLOT_KEYS,
  REPORT_SUMMARY_MOBILE_SLOT_COUNT,
  aggregateReportChannelCosts,
  aggregateReportTableMetrics,
  type ReportSummaryMetricOption,
  type ReportTableMetricKey,
} from "@/6-0-digital-marketing-shared/reportSummaryMetrics";
import { MobileReportSummaryMetricCard } from "@/mobile/6-0-report/components/MobileReportSummaryMetricCard";
import {
  reportPeriodCompareBits,
  useDmReportSummaryPeriodCompare,
} from "@/6-0-report/hooks/useDmReportSummaryPeriodCompare";

const SLOT_COUNT = REPORT_SUMMARY_MOBILE_SLOT_COUNT;
const DEFAULT_SLOT_KEYS = REPORT_SUMMARY_MOBILE_DEFAULT_SLOT_KEYS;

type Props = {
  bootstrapLoading?: boolean;
  googleServiceRows: ReportGoogleServiceRow[];
  metaServiceRows: ReportMetaServiceRow[];
  tiktokServiceRows?: ReportTikTokServiceRow[];
  servicesLoading?: boolean;
};

function normalizeSlotKeys(keys: ReportTableMetricKey[]): ReportTableMetricKey[] {
  const valid = new Set(REPORT_SUMMARY_METRIC_OPTIONS.map((o) => o.key));
  const result: ReportTableMetricKey[] = [];
  for (let i = 0; i < SLOT_COUNT; i++) {
    const fallback = DEFAULT_SLOT_KEYS[i] ?? "cost";
    const key = keys[i];
    result.push(key && valid.has(key) ? key : fallback);
  }
  return result;
}

export function MobileReportSummaryBar({
  bootstrapLoading = false,
  googleServiceRows,
  metaServiceRows,
  tiktokServiceRows = [],
  servicesLoading = false,
}: Props) {
  const { t } = useAppTranslation();
  const { googleCost, metaCost, tiktokCost } = useDigitalMarketingReportData();

  const [metricKeys, setMetricKeys] = useState<ReportTableMetricKey[]>(
    () => [...DEFAULT_SLOT_KEYS],
  );

  const { filteredGoogleRows, filteredMetaRows, filteredTikTokRows, rowsLoading } =
    useDigitalMarketingReportFilteredRows(googleServiceRows, metaServiceRows, tiktokServiceRows);

  const totals = useMemo(() => {
    const hasServiceRows =
      filteredGoogleRows.length > 0 ||
      filteredMetaRows.length > 0 ||
      filteredTikTokRows.length > 0;
    if (hasServiceRows) {
      return aggregateReportTableMetrics(
        filteredGoogleRows,
        filteredMetaRows,
        filteredTikTokRows,
      );
    }
    return aggregateReportChannelCosts(googleCost, metaCost, tiktokCost);
  }, [
    filteredGoogleRows,
    filteredMetaRows,
    filteredTikTokRows,
    googleCost,
    metaCost,
    tiktokCost,
  ]);

  const slots = useMemo(() => normalizeSlotKeys(metricKeys), [metricKeys]);

  const metricOptions: ReportSummaryMetricOption[] = useMemo(
    () =>
      REPORT_SUMMARY_METRIC_OPTIONS.map((opt) => ({
        ...opt,
        label:
          opt.key === "cost"
            ? t("digitalMarketing.report.tableCost", "Cost")
            : opt.key === "cpc"
              ? t("digitalMarketing.report.tableCpc", "CPC")
              : opt.key === "cpa"
                ? t("digitalMarketing.report.tableCostPerLead", "CPA")
                : opt.key === "converted_leads"
                  ? t("digitalMarketing.report.tableConvertedLeads", "Conv. leads")
                  : opt.key === "impressions"
                    ? t("digitalMarketing.report.tableImpressions", "Impressions")
                    : opt.key === "ctr"
                      ? t("digitalMarketing.report.tableCtr", "CTR")
                      : opt.key === "clicks"
                        ? t("digitalMarketing.report.tableClicks", "Clicks")
                        : opt.label,
        groupLabel: t("digitalMarketing.report.summaryMetricGroupPerformance", "Performance"),
      })),
    [t],
  );

  const metricValueKinds = useMemo(() => {
    const map: Record<string, ReturnType<typeof reportMetricValueKind>> = {};
    for (const opt of REPORT_SUMMARY_METRIC_OPTIONS) {
      map[opt.key] = reportMetricValueKind(opt.key);
    }
    return map;
  }, []);

  const { progressByReportSlot, targetsLoading } = useDmReportTargetProgress({
    googleCustomerId: null,
    metaAdAccountId: null,
    tiktokAdvertiserId: null,
    selectedReportMetrics: slots,
    valueKinds: metricValueKinds,
  });

  const loading = servicesLoading || rowsLoading;
  const mixedCurrencyLabel = t(
    "digitalMarketing.report.summaryMixedCurrency",
    "Mixed currencies",
  );
  const currencyCode = googleCost.currency;

  const { previousRange, previousTotals, compareLoading, compareError } =
    useDmReportSummaryPeriodCompare();

  if (loading && bootstrapLoading) {
    return (
      <div
        className="-mx-2 grid grid-cols-2 gap-px overflow-hidden border-y border-border bg-border"
        aria-busy
        aria-label={t("digitalMarketing.report.pageLoading", "Loading report")}
      >
        {Array.from({ length: SLOT_COUNT }, (_, i) => (
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

  return (
    <div className="-mx-2 grid grid-cols-2 gap-px overflow-hidden border-y border-border bg-border">
      {slots.map((key, index) => {
        const progress = progressByReportSlot.get(key);
        const ratioText =
          progress?.showProgress &&
          progress.target != null &&
          progress.target > 0 &&
          progress.actual != null
            ? `${formatDmActualValue("google", key, progress.actual, currencyCode)} / ${formatDmActualValue("google", key, progress.target, currencyCode)}`
            : null;
        const slotCompare = reportPeriodCompareBits({
          metricKey: key,
          currentTotals: totals,
          previousTotals,
          previousRange,
          compareLoading,
          compareError,
          mixedCurrencyLabel,
        });

        return (
          <MobileReportSummaryMetricCard
            key={index}
            selectedKey={key}
            onSelectKey={(nextKey) => {
              setMetricKeys((prev) => {
                const next = normalizeSlotKeys(prev);
                next[index] = nextKey;
                return next;
              });
            }}
            options={metricOptions}
            totals={totals}
            isLoading={loading}
            mixedCurrencyLabel={mixedCurrencyLabel}
            targetProgress={progress}
            targetsLoading={targetsLoading}
            progressRatioText={ratioText}
            {...slotCompare}
          />
        );
      })}
    </div>
  );
}
