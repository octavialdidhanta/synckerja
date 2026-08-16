import { useMemo, useState } from "react";
import { useDigitalMarketingReportData } from "@/6-0-digital-marketing-shared/DigitalMarketingReportDataContext";
import { formatDmActualValue } from "@/6-0-digital-marketing-shared/dmReportTargetActuals";
import { reportMetricValueKind } from "@/6-0-digital-marketing-shared/dmReportTargetMetricMapping";
import { useDmReportTargetProgress } from "@/6-0-digital-marketing-shared/hooks/useDmReportTargetProgress";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import type {
  ReportGoogleServiceRow,
  ReportMetaServiceRow,
  ReportTikTokServiceRow,
} from "@/6-0-digital-marketing-shared/hooks/useDigitalMarketingReportCosts";
import { useDigitalMarketingReportFilteredRows } from "@/6-0-digital-marketing-shared/hooks/useDigitalMarketingReportFilteredRows";
import {
  REPORT_SUMMARY_DEFAULT_SLOT_KEYS,
  REPORT_SUMMARY_METRIC_OPTIONS,
  REPORT_SUMMARY_SLOT_COUNT,
  aggregateReportChannelCosts,
  aggregateReportTableMetrics,
  type ReportSummaryMetricOption,
  type ReportTableMetricKey,
} from "@/6-0-digital-marketing-shared/reportSummaryMetrics";
import { DigitalMarketingReportSummaryMetricPicker } from "@/6-0-report/components/DigitalMarketingReportSummaryMetricPicker";
import {
  reportPeriodCompareBits,
  useDmReportSummaryPeriodCompare,
} from "@/6-0-report/hooks/useDmReportSummaryPeriodCompare";

const SLOT_COUNT = REPORT_SUMMARY_SLOT_COUNT;

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
    const fallback = REPORT_SUMMARY_DEFAULT_SLOT_KEYS[i] ?? "cost";
    const key = keys[i];
    result.push(key && valid.has(key) ? key : fallback);
  }
  return result;
}

export function DigitalMarketingReportSummaryBar({
  bootstrapLoading = false,
  googleServiceRows,
  metaServiceRows,
  tiktokServiceRows = [],
  servicesLoading = false,
}: Props) {
  const { t } = useAppTranslation();
  const { googleCost, metaCost, tiktokCost } = useDigitalMarketingReportData();

  const [metricKeys, setMetricKeys] = useState<ReportTableMetricKey[]>(
    () => [...REPORT_SUMMARY_DEFAULT_SLOT_KEYS],
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
    // Report summary is multi-channel aggregate — do not scope to a single Google default account.
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
    return null;
  }

  return (
    <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
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
          <DigitalMarketingReportSummaryMetricPicker
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
            searchPlaceholder={t(
              "digitalMarketing.report.summarySearchMetrics",
              "Search metrics…",
            )}
            emptyLabel={t("digitalMarketing.report.summaryNoMetrics", "No metrics found.")}
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
