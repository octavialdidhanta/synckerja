import { Link } from "react-router-dom";
import { useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { useToast } from "@/shared/components/ui/use-toast";
import { useDebouncedReady } from "@/shared/hooks/useDebouncedReady";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { POS_OUTLET_FILTER_ALL } from "@/8-2-2-outlets/lib/assignedOutlets";
import { ReportsSalesLayout } from "../../components/ReportsSalesLayout";
import { useReportsSalesPeriodFilters } from "../../shared/hooks/useReportsSalesPeriodFilters";
import { GrossProfitCogsAdjustmentSheet } from "../components/GrossProfitCogsAdjustmentSheet";
import { GrossProfitDailyChart } from "../components/GrossProfitDailyChart";
import { GrossProfitItemsTable } from "../components/GrossProfitItemsTable";
import { GrossProfitTable } from "../components/GrossProfitTable";
import { GrossProfitToolbar } from "../components/GrossProfitToolbar";
import { useGrossProfitCogsBackfill } from "../hooks/useGrossProfitCogsBackfill";
import { useGrossProfitDaily } from "../hooks/useGrossProfitDaily";
import { useGrossProfitItems } from "../hooks/useGrossProfitItems";
import { useGrossProfitNonProductBreakdown } from "../hooks/useGrossProfitNonProductBreakdown";
import { useGrossProfitReport } from "../hooks/useGrossProfitReport";
import { filterGrossProfitItemsBySearch } from "../lib/computeGrossProfitItemsDisplay";
import { exportGrossProfitXlsx } from "../lib/exportGrossProfitXlsx";

export function GrossProfitPage() {
  const { t } = useAppTranslation();
  const { toast } = useToast();
  const filters = useReportsSalesPeriodFilters();
  const [itemSearch, setItemSearch] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [cogsAdjOpen, setCogsAdjOpen] = useState(false);
  const { backfill, isPending: isBackfilling } = useGrossProfitCogsBackfill();
  const summary = useGrossProfitReport({
    outletId: filters.outletIdForQuery,
    fromIso: filters.timestamps.fromIso,
    toIso: filters.timestamps.toIso,
    enabled: !filters.isLoading,
  });
  const itemsQuery = useGrossProfitItems({
    outletId: filters.outletIdForQuery,
    fromIso: filters.timestamps.fromIso,
    toIso: filters.timestamps.toIso,
    categoryId,
    enabled: !filters.isLoading,
  });
  const dailyQuery = useGrossProfitDaily({
    outletId: filters.outletIdForQuery,
    fromIso: filters.timestamps.fromIso,
    toIso: filters.timestamps.toIso,
    enabled: !filters.isLoading,
  });
  const nonProductQuery = useGrossProfitNonProductBreakdown({
    outletId: filters.outletIdForQuery,
    fromIso: filters.timestamps.fromIso,
    toIso: filters.timestamps.toIso,
    enabled: !filters.isLoading && summary.metrics.nonProductNet > 0.01,
  });
  const showContent = useDebouncedReady(
    !(
      summary.isLoading ||
      itemsQuery.isLoading ||
      dailyQuery.isLoading ||
      (summary.metrics.nonProductNet > 0.01 && nonProductQuery.isLoading) ||
      filters.isLoading
    ),
  );

  const outletLabel =
    filters.selectedOutletId === POS_OUTLET_FILTER_ALL
      ? t("outlets.filter.all", "All Outlets")
      : filters.selectedOutletName || t("outlets.filter.placeholder", "Outlet");

  const outletQuery =
    filters.selectedOutletId && filters.selectedOutletId !== POS_OUTLET_FILTER_ALL
      ? filters.selectedOutletId
      : "all";

  const handleExport = () => {
    exportGrossProfitXlsx({
      metrics: summary.metrics,
      items: filterGrossProfitItemsBySearch(itemsQuery.items, itemSearch),
      nonProductRows: nonProductQuery.rows,
      outletLabel,
      fromYmd: filters.dateRange.from,
      toYmd: filters.dateRange.to,
    });
  };

  const handleBackfill = async () => {
    try {
      const result = await backfill(filters.outletIdForQuery);
      toast({
        title: t("reports.grossProfit.backfill.doneTitle", "Estimated COGS updated"),
        description: t(
          "reports.grossProfit.backfill.doneDescription",
          "Updated {{updated}} lines. {{skipped}} still incomplete.",
          {
            updated: result.updatedCount,
            skipped: result.skippedCount,
          },
        ),
      });
    } catch (err) {
      toast({
        title:
          err instanceof Error
            ? err.message
            : t("reports.grossProfit.backfill.error", "Failed to backfill COGS."),
        variant: "destructive",
      });
    }
  };

  const isError = summary.isError || itemsQuery.isError || dailyQuery.isError;
  const error = summary.error ?? itemsQuery.error ?? dailyQuery.error;

  return (
    <ReportsSalesLayout showContent={showContent}>
      <div className="min-w-0">
        <GrossProfitToolbar
          outletId={filters.selectedOutletId}
          onOutletChange={filters.setSelectedOutletId}
          dateRange={filters.dateRange}
          onDateRangeChange={filters.setDateRange}
          timeFilter={filters.timeFilter}
          onTimeFilterChange={filters.setTimeFilter}
          onApplyFilters={filters.setDateRangeAndTime}
          onExport={handleExport}
          exportDisabled={!showContent || isError}
          onManageCogsAdjustments={() => setCogsAdjOpen(true)}
        />
        {isError ? (
          <p className="mb-3 text-sm text-destructive">
            {error instanceof Error
              ? error.message
              : t("reports.grossProfit.loadError", "Failed to load gross profit.")}
          </p>
        ) : null}
        {summary.metrics.cogsIncomplete ? (
          <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <p>
              {t(
                "reports.grossProfit.cogsIncomplete",
                "Some sold products have incomplete COGS. Fill HPP on Item Library or Recipes for accurate profit.",
              )}
            </p>
            <p className="mt-2 flex flex-wrap items-center gap-3">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-amber-300 bg-white text-amber-900 hover:bg-amber-100"
                disabled={isBackfilling}
                onClick={() => void handleBackfill()}
              >
                {isBackfilling
                  ? t("reports.grossProfit.backfill.running", "Filling…")
                  : t(
                      "reports.grossProfit.backfill.cta",
                      "Fill estimated COGS for old sales",
                    )}
              </Button>
              <Link
                to={`/operations/library/product-list?outlet=${outletQuery}`}
                className="font-medium text-primary hover:underline"
              >
                {t("reports.grossProfit.linkItemLibrary", "Item Library")}
              </Link>
              <Link
                to={`/operations/ingredient/recipes?outlet=${outletQuery}`}
                className="font-medium text-primary hover:underline"
              >
                {t("reports.grossProfit.linkRecipes", "Recipes")}
              </Link>
            </p>
          </div>
        ) : null}
        <GrossProfitTable metrics={summary.metrics} />
        <GrossProfitDailyChart points={dailyQuery.points} />
        <GrossProfitItemsTable
          items={itemsQuery.items}
          nonProductRows={nonProductQuery.rows}
          nonProductLoading={
            summary.metrics.nonProductNet > 0.01 && nonProductQuery.isLoading
          }
          search={itemSearch}
          onSearchChange={setItemSearch}
          categoryId={categoryId}
          onCategoryChange={setCategoryId}
          metrics={{
            netSales: summary.metrics.netSales,
            productNetSales: summary.metrics.productNetSales,
            nonProductNet: summary.metrics.nonProductNet,
          }}
        />
      </div>
      <GrossProfitCogsAdjustmentSheet
        open={cogsAdjOpen}
        onOpenChange={setCogsAdjOpen}
        outletId={filters.outletIdForQuery}
        outletLabel={outletLabel}
        fromYmd={filters.dateRange.from}
        toYmd={filters.dateRange.to}
      />
    </ReportsSalesLayout>
  );
}
