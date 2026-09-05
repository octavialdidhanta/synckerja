import { useLayoutEffect, useState } from "react";
import { SalesSummaryDateRangePicker } from "@/8-2-10-reports/sales-summary/components/SalesSummaryDateRangePicker";
import type { SalesSummaryDateRange } from "@/8-2-10-reports/sales-summary/lib/salesSummaryTypes";
import { Button } from "@/shared/components/ui/button";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useDashboardOutletComparison } from "../hooks/useDashboardOutletComparison";
import { DashboardChooseOutletsDialog } from "./DashboardChooseOutletsDialog";
import { DashboardComparisonGraph } from "./DashboardComparisonGraph";
import { DashboardComparisonTable } from "./DashboardComparisonTable";

type Props = {
  compareOutletIds: string[];
  dateRange: SalesSummaryDateRange;
  fromIso: string;
  toIso: string;
  onCompareOutletIdsChange: (ids: string[]) => void;
  onDateRangeChange: (dateRange: SalesSummaryDateRange) => void;
  ready?: boolean;
  onLoadingChange?: (loading: boolean) => void;
};

export function DashboardComparisonPanel({
  compareOutletIds,
  dateRange,
  fromIso,
  toIso,
  onCompareOutletIdsChange,
  onDateRangeChange,
  ready = true,
  onLoadingChange,
}: Props) {
  const { t } = useAppTranslation();
  const [chooseOpen, setChooseOpen] = useState(false);
  const timeFilter = {
    allDay: true,
    startTime: "00:00",
    endTime: "23:59",
  } as const;

  const comparison = useDashboardOutletComparison({
    outletIds: compareOutletIds,
    fromIso,
    toIso,
    enabled: ready && compareOutletIds.length >= 2,
  });

  const loading = compareOutletIds.length >= 2 ? comparison.isLoading : false;

  useLayoutEffect(() => {
    onLoadingChange?.(loading);
  }, [loading, onLoadingChange]);

  if (!ready) return null;

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-card p-3 shadow-sm">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">
            {t("operationsDashboard.filters.outlet", "Outlet")}
          </p>
          <Button type="button" variant="outline" onClick={() => setChooseOpen(true)}>
            {compareOutletIds.length === 0
              ? t("operationsDashboard.compare.chooseTitle", "Choose Outlet")
              : t("operationsDashboard.compare.selectedCount", "Selected: {{count}}", {
                  count: compareOutletIds.length,
                })}
          </Button>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">
            {t("operationsDashboard.filters.period", "Period")}
          </p>
          <SalesSummaryDateRangePicker
            dateRange={dateRange}
            onDateRangeChange={onDateRangeChange}
            timeFilter={timeFilter}
            onTimeFilterChange={() => undefined}
            onApplyFilters={(range) => onDateRangeChange(range)}
            hideTimeFilter
          />
        </div>
      </div>

      {comparison.isError ? (
        <p className="text-sm text-destructive">
          {comparison.error instanceof Error
            ? comparison.error.message
            : t("operationsDashboard.loadError", "Failed to load dashboard metrics.")}
        </p>
      ) : null}

      <DashboardComparisonTable
        rows={compareOutletIds.length >= 2 ? comparison.rows : []}
        onAddOutlet={() => setChooseOpen(true)}
        onEditOutlets={() => setChooseOpen(true)}
      />
      <DashboardComparisonGraph
        rows={compareOutletIds.length >= 2 ? comparison.rows : []}
      />

      <DashboardChooseOutletsDialog
        open={chooseOpen}
        onOpenChange={setChooseOpen}
        selectedIds={compareOutletIds}
        onConfirm={onCompareOutletIdsChange}
      />
    </div>
  );
}
