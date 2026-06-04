import { useMemo } from "react";
import { useDigitalMarketingPaidAdsFilters } from "@/6-0-digital-marketing-shared/DigitalMarketingPaidAdsFiltersContext";
import type {
  ReportGoogleServiceRow,
  ReportMetaServiceRow,
} from "@/6-0-digital-marketing-shared/hooks/useDigitalMarketingReportCosts";
import { useDigitalMarketingReportMonthlySpend } from "@/6-0-digital-marketing-shared/hooks/useDigitalMarketingReportMonthlySpend";
import {
  alignServiceRowWithChartPeriod,
  reportRowMatchesServiceFilter,
  type ReportServiceFilterValue,
} from "@/6-0-digital-marketing-shared/reportServiceFilter";

export function useDigitalMarketingReportFilteredRows(
  googleServiceRows: ReportGoogleServiceRow[],
  metaServiceRows: ReportMetaServiceRow[],
) {
  const { reportServiceFilter, reportChartYear } = useDigitalMarketingPaidAdsFilters();
  const { googleSeries, metaSeries, chartLoading } =
    useDigitalMarketingReportMonthlySpend(reportChartYear);

  const useChartAlignedTotals = Boolean(reportServiceFilter);
  const chartTotalsReady =
    useChartAlignedTotals && !chartLoading && !googleSeries.loading && !metaSeries.loading;

  const filteredGoogleRows = useMemo(() => {
    return googleServiceRows
      .filter((row) =>
        reportRowMatchesServiceFilter(row, reportServiceFilter as ReportServiceFilterValue),
      )
      .map((row) =>
        alignServiceRowWithChartPeriod(row, googleSeries.periodSummary, chartTotalsReady),
      );
  }, [
    googleServiceRows,
    reportServiceFilter,
    googleSeries.periodSummary,
    chartTotalsReady,
  ]);

  const filteredMetaRows = useMemo(() => {
    return metaServiceRows
      .filter((row) =>
        reportRowMatchesServiceFilter(row, reportServiceFilter as ReportServiceFilterValue),
      )
      .map((row) =>
        alignServiceRowWithChartPeriod(row, metaSeries.periodSummary, chartTotalsReady),
      );
  }, [metaServiceRows, reportServiceFilter, metaSeries.periodSummary, chartTotalsReady]);

  const rowsLoading =
    chartLoading ||
    (useChartAlignedTotals && (googleSeries.loading || metaSeries.loading));

  return {
    filteredGoogleRows,
    filteredMetaRows,
    rowsLoading,
    useChartAlignedTotals,
  };
}
