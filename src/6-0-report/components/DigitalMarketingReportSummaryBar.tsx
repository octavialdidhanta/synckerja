import { useMemo, useState } from "react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import type {
  ReportGoogleServiceRow,
  ReportMetaServiceRow,
} from "@/6-0-digital-marketing-shared/hooks/useDigitalMarketingReportCosts";
import { useDigitalMarketingReportFilteredRows } from "@/6-0-digital-marketing-shared/hooks/useDigitalMarketingReportFilteredRows";
import {
  REPORT_SUMMARY_DEFAULT_SLOT_KEYS,
  REPORT_SUMMARY_METRIC_OPTIONS,
  REPORT_SUMMARY_SLOT_COUNT,
  aggregateReportTableMetrics,
  type ReportSummaryMetricOption,
  type ReportTableMetricKey,
} from "@/6-0-digital-marketing-shared/reportSummaryMetrics";
import { DigitalMarketingReportSummaryMetricPicker } from "@/6-0-report/components/DigitalMarketingReportSummaryMetricPicker";

const SLOT_COUNT = REPORT_SUMMARY_SLOT_COUNT;

type Props = {
  bootstrapLoading?: boolean;
  googleServiceRows: ReportGoogleServiceRow[];
  metaServiceRows: ReportMetaServiceRow[];
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
  servicesLoading = false,
}: Props) {
  const { t } = useAppTranslation();
  const [metricKeys, setMetricKeys] = useState<ReportTableMetricKey[]>(
    () => [...REPORT_SUMMARY_DEFAULT_SLOT_KEYS],
  );

  const { filteredGoogleRows, filteredMetaRows, rowsLoading } =
    useDigitalMarketingReportFilteredRows(googleServiceRows, metaServiceRows);

  const totals = useMemo(
    () => aggregateReportTableMetrics(filteredGoogleRows, filteredMetaRows),
    [filteredGoogleRows, filteredMetaRows],
  );

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

  const loading = servicesLoading || rowsLoading;
  const mixedCurrencyLabel = t(
    "digitalMarketing.report.summaryMixedCurrency",
    "Mixed currencies",
  );

  if (loading && bootstrapLoading) {
    return null;
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {slots.map((key, index) => (
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
        />
      ))}
    </div>
  );
}
