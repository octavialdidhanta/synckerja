import { useMemo } from "react";
import { useDigitalMarketingPaidAdsFilters } from "@/6-0-digital-marketing-shared/DigitalMarketingPaidAdsFiltersContext";
import type {
  ReportGoogleServiceRow,
  ReportMetaServiceRow,
  ReportTikTokServiceRow,
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
  tiktokServiceRows: ReportTikTokServiceRow[] = [],
) {
  const { reportServiceFilter, reportChartYear } = useDigitalMarketingPaidAdsFilters();
  const { googleSeries, metaSeries, tiktokSeries, chartLoading } =
    useDigitalMarketingReportMonthlySpend(reportChartYear);

  const useChartAlignedTotals = Boolean(reportServiceFilter);
  const chartTotalsReady =
    useChartAlignedTotals &&
    !chartLoading &&
    !googleSeries.loading &&
    !metaSeries.loading &&
    !tiktokSeries.loading;

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

  const filteredTikTokRows = useMemo(() => {
    return tiktokServiceRows
      .filter((row) =>
        reportRowMatchesServiceFilter(row, reportServiceFilter as ReportServiceFilterValue),
      )
      .map((row) =>
        alignServiceRowWithChartPeriod(row, tiktokSeries.periodSummary, chartTotalsReady),
      );
  }, [tiktokServiceRows, reportServiceFilter, tiktokSeries.periodSummary, chartTotalsReady]);

  const rowsLoading =
    chartLoading ||
    (useChartAlignedTotals &&
      (googleSeries.loading || metaSeries.loading || tiktokSeries.loading));

  return {
    filteredGoogleRows,
    filteredMetaRows,
    filteredTikTokRows,
    rowsLoading,
    useChartAlignedTotals,
  };
}
