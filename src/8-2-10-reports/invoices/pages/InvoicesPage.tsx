import { useRef, useState } from "react";
import { POS_OUTLET_FILTER_ALL } from "@/8-2-2-outlets/lib/assignedOutlets";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { supabase } from "@/shared/lib/supabaseClient";
import { cn } from "@/shared/lib/utils";
import { ReportsSalesLayout } from "../../components/ReportsSalesLayout";
import { useInvoicesList } from "../hooks/useInvoicesList";
import { InvoiceDetailSheet } from "../shared/components/InvoiceDetailSheet";
import { InvoicesTable } from "../shared/components/InvoicesTable";
import { InvoicesToolbar } from "../shared/components/InvoicesToolbar";
import { useInvoicesFilters } from "../shared/hooks/useInvoicesFilters";
import {
  exportInvoicesXlsx,
  type InvoiceExportMode,
  type InvoiceItemExportRow,
} from "../shared/lib/exportInvoicesXlsx";
import type { InvoiceRow } from "../shared/lib/invoicesTypes";
import { InvoicesListPaneSkeleton } from "./InvoicesListPaneSkeleton";
import { InvoicesPageSkeleton } from "./InvoicesPageSkeleton";

function InvoicesSummaryBar({
  summary,
}: {
  summary: {
    count: number;
    unpaid: number;
    partial: number;
    paid: number;
    overdue: number;
    cancelled: number;
  };
}) {
  const { t } = useAppTranslation();
  const items = [
    { label: t("reports.invoices.summary.total", "Invoices"), value: summary.count },
    { label: t("reports.invoices.status.unpaid", "Unpaid"), value: summary.unpaid },
    { label: t("reports.invoices.status.partial", "Partially Paid"), value: summary.partial },
    { label: t("reports.invoices.status.paid", "Paid"), value: summary.paid },
    { label: t("reports.invoices.status.overdue", "Overdue"), value: summary.overdue },
    { label: t("reports.invoices.status.cancelled", "Cancelled"), value: summary.cancelled },
  ];

  return (
    <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      {items.map((item) => (
        <div key={item.label} className="rounded-md border border-border bg-muted/20 px-3 py-2">
          <p className="text-xs text-muted-foreground">{item.label}</p>
          <p className="text-lg font-semibold text-gray-900">{item.value}</p>
        </div>
      ))}
    </div>
  );
}

export function InvoicesPage() {
  const { t } = useAppTranslation();
  const filters = useInvoicesFilters();
  const list = useInvoicesList({
    outletId: filters.outletIdForQuery,
    fromIso: filters.timestamps.fromIso,
    toIso: filters.timestamps.toIso,
    statusFilter: filters.statusFilter,
    searchQuery: filters.searchQuery,
    enabled: !filters.isLoading,
  });

  // Full-page gate only for outlet bootstrap. Skip useDebouncedReady — it starts false
  // for ~200ms on every mount and flashes the full-route skeleton.
  const showContent = !filters.isLoading;

  const [selectedRow, setSelectedRow] = useState<InvoiceRow | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const stableCountRef = useRef(0);
  if (!list.isLoading) {
    stableCountRef.current = list.rows.length;
  }

  const outletLabel =
    filters.selectedOutletId === POS_OUTLET_FILTER_ALL
      ? t("outlets.filter.all", "All Outlets")
      : filters.selectedOutletName || t("outlets.filter.placeholder", "Outlet");

  const fetchItemExportRows = async (): Promise<InvoiceItemExportRow[]> => {
    const activityIds = list.rows.map((r) => r.activityId);
    if (activityIds.length === 0) return [];

    const { data, error } = await supabase
      .from("sales_activity_items")
      .select(
        "sales_activity_id, service_name, sub_service_name, quantity, unit_price, total_price",
      )
      .in("sales_activity_id", activityIds);
    if (error) throw error;

    const rowById = new Map(list.rows.map((r) => [r.activityId, r]));
    return (data ?? []).flatMap((item) => {
      const parent = rowById.get(item.sales_activity_id);
      if (!parent) return [];
      return [
        {
          invoiceNumber: parent.invoiceNumber,
          clientName: parent.clientName,
          outletName: parent.outletName,
          serviceName: item.service_name ?? "Item",
          subServiceName: item.sub_service_name ?? null,
          quantity: Number(item.quantity ?? 1),
          unitPrice: Number(item.unit_price ?? 0),
          totalPrice: Number(item.total_price ?? 0),
          displayStatus: parent.displayStatus,
        },
      ];
    });
  };

  const handleExport = async (mode: InvoiceExportMode) => {
    const itemRows = mode === "itemDetails" ? await fetchItemExportRows() : undefined;
    exportInvoicesXlsx({
      mode,
      outletLabel,
      fromYmd: filters.dateRange.from,
      toYmd: filters.dateRange.to,
      rows: list.rows,
      itemRows,
    });
  };

  const handleRowClick = (row: InvoiceRow) => {
    setSelectedRow(row);
    setDetailOpen(true);
  };

  return (
    <ReportsSalesLayout
      showContent={showContent}
      showSalesNav={false}
      loadingSkeleton={<InvoicesPageSkeleton />}
      count={stableCountRef.current}
    >
      <div className="min-w-0">
        <InvoicesToolbar
          outletId={filters.selectedOutletId}
          onOutletChange={filters.setSelectedOutletId}
          dateRange={filters.dateRange}
          onDateRangeChange={filters.setDateRange}
          timeFilter={filters.timeFilter}
          onTimeFilterChange={filters.setTimeFilter}
          onApplyFilters={filters.setDateRangeAndTime}
          statusFilter={filters.statusFilter}
          onStatusFilterChange={filters.setStatusFilter}
          searchQuery={filters.searchQuery}
          onSearchQueryChange={filters.setSearchQuery}
          onExport={handleExport}
          exportDisabled={!showContent || list.isLoading || list.isError}
        />
        {list.isError ? (
          <p className="mb-3 text-sm text-destructive">
            {list.error instanceof Error
              ? list.error.message
              : t("reports.invoices.loadError", "Failed to load invoices.")}
          </p>
        ) : null}
        {list.isLoading ? (
          <InvoicesListPaneSkeleton />
        ) : (
          <div
            className={cn(
              list.isFetching && !list.isLoadingMore && "opacity-70 transition-opacity",
            )}
          >
            <InvoicesSummaryBar summary={list.summary} />
            <InvoicesTable
              rows={list.rows}
              hasMore={Boolean(list.hasMore)}
              isLoadingMore={list.isLoadingMore}
              onLoadMore={() => list.loadMore()}
              onRowClick={handleRowClick}
            />
          </div>
        )}
      </div>
      <InvoiceDetailSheet
        row={selectedRow}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onCancelled={() => list.refetch()}
      />
    </ReportsSalesLayout>
  );
}
