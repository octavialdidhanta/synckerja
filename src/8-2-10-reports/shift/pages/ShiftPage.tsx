import { useState } from "react";
import { POS_OUTLET_FILTER_ALL } from "@/8-2-2-outlets/lib/assignedOutlets";
import { useDebouncedReady } from "@/shared/hooks/useDebouncedReady";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { ReportsSalesLayout } from "../../components/ReportsSalesLayout";
import { useShiftList } from "../hooks/useShiftList";
import { ShiftDetailSheet } from "../shared/components/ShiftDetailSheet";
import { ShiftTable } from "../shared/components/ShiftTable";
import { ShiftToolbar } from "../shared/components/ShiftToolbar";
import { useShiftFilters } from "../shared/hooks/useShiftFilters";
import { useShiftStaffOptions } from "../shared/hooks/useShiftStaffOptions";
import { exportShiftXlsx } from "../shared/lib/exportShiftXlsx";
import type { ShiftListSummary, ShiftRow } from "../shared/lib/shiftTypes";
import { formatReportsMoney } from "../../shared/lib/formatReportsMoney";
import { ShiftPageSkeleton } from "./ShiftPageSkeleton";

function ShiftSummaryBar({ summary }: { summary: ShiftListSummary }) {
  const { t } = useAppTranslation();
  const items = [
    { label: t("reports.shift.summary.total", "Shifts"), value: summary.shiftCount },
    { label: t("reports.shift.summary.open", "Open"), value: summary.openCount },
    {
      label: t("reports.shift.summary.shortage", "Total shortage"),
      value: formatReportsMoney(summary.totalShortage),
    },
  ];

  return (
    <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
      {items.map((item) => (
        <div key={item.label} className="rounded-md border border-border bg-muted/20 px-3 py-2">
          <p className="text-xs text-muted-foreground">{item.label}</p>
          <p className="text-lg font-semibold text-gray-900">{item.value}</p>
        </div>
      ))}
    </div>
  );
}

export function ShiftPage() {
  const { t } = useAppTranslation();
  const filters = useShiftFilters();
  const staffOptions = useShiftStaffOptions();
  const list = useShiftList({
    outletId: filters.outletIdForQuery,
    fromIso: filters.timestamps.fromIso,
    toIso: filters.timestamps.toIso,
    openedBy: filters.openedByForQuery,
    enabled: !filters.isLoading && !staffOptions.isLoading,
  });

  const showContent = useDebouncedReady(
    !(list.isLoading || filters.isLoading || staffOptions.isLoading),
  );
  const [selectedRow, setSelectedRow] = useState<ShiftRow | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const outletLabel =
    filters.selectedOutletId === POS_OUTLET_FILTER_ALL
      ? t("outlets.filter.all", "All Outlets")
      : filters.selectedOutletName || t("outlets.filter.placeholder", "Outlet");

  const staffLabel =
    filters.staffUserId === filters.staffFilterAll
      ? t("reports.shift.filters.staffAll", "All staff")
      : staffOptions.options.find((o) => o.userId === filters.staffUserId)?.label ??
        t("reports.shift.filters.staff", "Staff");

  const handleExport = () => {
    exportShiftXlsx({
      outletLabel,
      fromYmd: filters.dateRange.from,
      toYmd: filters.dateRange.to,
      staffLabel,
      rows: list.rows,
    });
  };

  return (
    <ReportsSalesLayout
      showSalesNav={false}
      showContent={showContent}
      loadingSkeleton={<ShiftPageSkeleton />}
    >
      <ShiftToolbar
        outletId={filters.selectedOutletId}
        onOutletChange={filters.setSelectedOutletId}
        dateRange={filters.dateRange}
        onDateRangeChange={filters.setDateRange}
        timeFilter={filters.timeFilter}
        onTimeFilterChange={filters.setTimeFilter}
        onApplyFilters={filters.setDateRangeAndTime}
        staffUserId={filters.staffUserId}
        onStaffUserIdChange={filters.setStaffUserId}
        staffFilterAll={filters.staffFilterAll}
        staffOptions={staffOptions.options}
        staffOptionsLoading={staffOptions.isLoading}
        onExport={handleExport}
        exportDisabled={list.rows.length === 0}
      />

      {showContent ? (
        <>
          <ShiftSummaryBar summary={list.summary} />
          <ShiftTable
            rows={list.rows}
            hasMore={Boolean(list.hasMore)}
            isLoadingMore={list.isLoadingMore}
            onLoadMore={() => void list.loadMore()}
            onRowClick={(row) => {
              setSelectedRow(row);
              setDetailOpen(true);
            }}
          />
        </>
      ) : null}

      <ShiftDetailSheet
        row={selectedRow}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </ReportsSalesLayout>
  );
}
