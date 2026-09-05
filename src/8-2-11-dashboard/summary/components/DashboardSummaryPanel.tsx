import { useLayoutEffect } from "react";
import type { SalesSummaryDateRange } from "@/8-2-10-reports/sales-summary/lib/salesSummaryTypes";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { DashboardCategoryPieCard } from "./DashboardCategoryPieCard";
import { DashboardDailyGrossChart } from "./DashboardDailyGrossChart";
import { DashboardDowGrossChart } from "./DashboardDowGrossChart";
import { DashboardFilterBar } from "./DashboardFilterBar";
import { DashboardHourlyGrossChart } from "./DashboardHourlyGrossChart";
import { DashboardSalesSummaryCards } from "./DashboardSalesSummaryCards";
import { DashboardTopItemsByCategoryGrid } from "./DashboardTopItemsByCategoryGrid";
import { DashboardTopItemsTable } from "./DashboardTopItemsTable";
import { useDashboardItemSummary } from "../hooks/useDashboardItemSummary";
import { useDashboardSummaryMetrics } from "../hooks/useDashboardSummaryMetrics";
import { useDashboardTimeSeries } from "../hooks/useDashboardTimeSeries";

type Props = {
  outletId: string | null;
  dateRange: SalesSummaryDateRange;
  fromIso: string;
  toIso: string;
  onOutletIdChange: (outletId: string | null) => void;
  onDateRangeChange: (dateRange: SalesSummaryDateRange) => void;
  ready?: boolean;
  onLoadingChange?: (loading: boolean) => void;
};

export function DashboardSummaryPanel({
  outletId,
  dateRange,
  fromIso,
  toIso,
  onOutletIdChange,
  onDateRangeChange,
  ready = true,
  onLoadingChange,
}: Props) {
  const { t } = useAppTranslation();
  const args = { outletId, fromIso, toIso };
  const summary = useDashboardSummaryMetrics(args);
  const timeSeries = useDashboardTimeSeries(args);
  const items = useDashboardItemSummary(args);
  const loading = summary.isLoading || timeSeries.isLoading || items.isLoading;
  const error = summary.error ?? timeSeries.error ?? items.error;

  useLayoutEffect(() => {
    onLoadingChange?.(loading);
  }, [loading, onLoadingChange]);

  if (!ready) return null;

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <DashboardFilterBar
        outletId={outletId}
        dateRange={dateRange}
        onOutletIdChange={onOutletIdChange}
        onDateRangeChange={onDateRangeChange}
      />
      {summary.isError || timeSeries.isError || items.isError ? (
        <p className="text-sm text-destructive">
          {error instanceof Error
            ? error.message
            : t("operationsDashboard.loadError", "Failed to load dashboard metrics.")}
        </p>
      ) : null}
      <DashboardSalesSummaryCards metrics={summary.metrics} />
      <DashboardDailyGrossChart points={timeSeries.dailyPoints} />
      <div className="grid gap-2 xl:grid-cols-2">
        <DashboardDowGrossChart points={timeSeries.dowPoints} />
        <DashboardHourlyGrossChart points={timeSeries.hourlyPoints} />
      </div>
      <DashboardTopItemsTable items={items.top10} />
      <div className="grid gap-2 xl:grid-cols-2">
        <DashboardCategoryPieCard
          title={t("operationsDashboard.categories.volume", "CATEGORY BY VOLUME")}
          slices={items.categoryQtySlices}
        />
        <DashboardCategoryPieCard
          title={t("operationsDashboard.categories.sales", "CATEGORY BY SALES")}
          slices={items.categorySalesSlices}
        />
      </div>
      <DashboardTopItemsByCategoryGrid categories={items.topItemsByCategory} />
    </div>
  );
}
