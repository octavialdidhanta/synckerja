import { useRef } from "react";
import { TransactionsPageSkeleton } from "./TransactionsPageSkeleton";
import { TransactionsListPaneSkeleton } from "./TransactionsListPaneSkeleton";
import { POS_OUTLET_FILTER_ALL } from "@/8-2-2-outlets/lib/assignedOutlets";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { ReportsSalesLayout } from "../../components/ReportsSalesLayout";
import { CancelledOrdersList } from "../cancelled-orders/components/CancelledOrdersList";
import { useCancelledOrdersList } from "../cancelled-orders/hooks/useCancelledOrdersList";
import {
  TRANSACTIONS_TAB_IDS,
  transactionsTabLabelKey,
  type TransactionsTabId,
} from "../layout/transactionsTabs";
import { exportTransactionsXlsx } from "../shared/lib/exportTransactionsXlsx";
import { useTransactionsFilters } from "../shared/hooks/useTransactionsFilters";
import { TransactionsToolbar } from "../shared/components/TransactionsToolbar";
import { SuccessOrdersList } from "../success-orders/components/SuccessOrdersList";
import { useSuccessOrdersList } from "../success-orders/hooks/useSuccessOrdersList";
import { VoidItemsList } from "../void-items/components/VoidItemsList";
import { useVoidItemsList } from "../void-items/hooks/useVoidItemsList";

function TransactionsSubTabs({
  tab,
  onTabChange,
}: {
  tab: TransactionsTabId;
  onTabChange: (tab: TransactionsTabId) => void;
}) {
  const { t } = useAppTranslation();

  return (
    <div className="mb-4 border-b border-border">
      <div className="flex flex-wrap gap-x-6 gap-y-1">
        {TRANSACTIONS_TAB_IDS.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => onTabChange(id)}
            className={cn(
              "-mb-px border-b-2 px-1 pb-2 text-sm font-medium transition-colors",
              tab === id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-gray-900",
            )}
          >
            {t(transactionsTabLabelKey(id), id === "success" ? "Success Orders" : id === "cancelled" ? "Cancelled Orders" : "Void Items")}
          </button>
        ))}
      </div>
    </div>
  );
}

export function TransactionsPage() {
  const { t } = useAppTranslation();
  const filters = useTransactionsFilters();

  // Prefetch all tabs with the same filters so switching Success/Cancelled/Void stays warm.
  const listEnabled = !filters.isLoading;
  const listArgs = {
    outletId: filters.outletIdForQuery,
    fromIso: filters.timestamps.fromIso,
    toIso: filters.timestamps.toIso,
    enabled: listEnabled,
  };

  const success = useSuccessOrdersList({
    ...listArgs,
    receiptQuery: filters.receiptQuery,
  });
  const cancelled = useCancelledOrdersList(listArgs);
  const voidItems = useVoidItemsList(listArgs);

  const activeLoading =
    filters.tab === "success"
      ? success.isLoading
      : filters.tab === "cancelled"
        ? cancelled.isLoading
        : voidItems.isLoading;

  // Full-page gate only while outlets bootstrap. Skip useDebouncedReady — it flashes
  // a full-route skeleton for ~200ms on every mount even when outlets are already cached.
  const showContent = !filters.isLoading;

  const outletLabel =
    filters.selectedOutletId === POS_OUTLET_FILTER_ALL
      ? t("outlets.filter.all", "All Outlets")
      : filters.selectedOutletName || t("outlets.filter.placeholder", "Outlet");

  const handleExport = () => {
    exportTransactionsXlsx({
      tab: filters.tab,
      outletLabel,
      fromYmd: filters.dateRange.from,
      toYmd: filters.dateRange.to,
      successRows: filters.tab === "success" ? success.rows : undefined,
      cancelledRows: filters.tab === "cancelled" ? cancelled.rows : undefined,
      voidRows: filters.tab === "void" ? voidItems.rows : undefined,
    });
  };

  const activeError =
    filters.tab === "success"
      ? success.isError
      : filters.tab === "cancelled"
        ? cancelled.isError
        : voidItems.isError;

  const activeErrorObj =
    filters.tab === "success"
      ? success.error
      : filters.tab === "cancelled"
        ? cancelled.error
        : voidItems.error;

  const activeCount =
    filters.tab === "success"
      ? success.rows.length
      : filters.tab === "cancelled"
        ? cancelled.rows.length
        : voidItems.rows.length;

  const stableCountRef = useRef(0);
  if (!activeLoading) {
    stableCountRef.current = activeCount;
  }

  return (
    <ReportsSalesLayout
      showContent={showContent}
      showSalesNav={false}
      loadingSkeleton={<TransactionsPageSkeleton />}
      count={stableCountRef.current}
    >
      <div className="min-w-0">
        <TransactionsToolbar
          tab={filters.tab}
          outletId={filters.selectedOutletId}
          onOutletChange={filters.setSelectedOutletId}
          dateRange={filters.dateRange}
          onDateRangeChange={filters.setDateRange}
          timeFilter={filters.timeFilter}
          onTimeFilterChange={filters.setTimeFilter}
          onApplyFilters={filters.setDateRangeAndTime}
          receiptQuery={filters.receiptQuery}
          onReceiptQueryChange={filters.setReceiptQuery}
          onExport={handleExport}
          exportDisabled={!showContent || activeLoading || activeError}
        />
        <TransactionsSubTabs tab={filters.tab} onTabChange={filters.setTab} />
        {activeError ? (
          <p className="mb-3 text-sm text-destructive">
            {activeErrorObj instanceof Error
              ? activeErrorObj.message
              : t("reports.transactions.loadError", "Failed to load transactions.")}
          </p>
        ) : null}

        {/* Keep panes mounted so tab switches do not remount lists / flash empty states. */}
        <div className={cn(filters.tab !== "success" && "hidden")} aria-hidden={filters.tab !== "success"}>
          {success.isLoading ? (
            <TransactionsListPaneSkeleton tab="success" />
          ) : (
            <SuccessOrdersList
              groups={success.groups}
              summary={success.summary}
              hasMore={success.hasMore}
              isLoadingMore={success.isLoadingMore}
              onLoadMore={() => success.loadMore()}
            />
          )}
        </div>
        <div className={cn(filters.tab !== "cancelled" && "hidden")} aria-hidden={filters.tab !== "cancelled"}>
          {cancelled.isLoading ? (
            <TransactionsListPaneSkeleton tab="cancelled" />
          ) : (
            <CancelledOrdersList
              groups={cancelled.groups}
              hasMore={cancelled.hasMore}
              isLoadingMore={cancelled.isLoadingMore}
              onLoadMore={() => cancelled.loadMore()}
            />
          )}
        </div>
        <div className={cn(filters.tab !== "void" && "hidden")} aria-hidden={filters.tab !== "void"}>
          {voidItems.isLoading ? (
            <TransactionsListPaneSkeleton tab="void" />
          ) : (
            <VoidItemsList
              groups={voidItems.groups}
              hasMore={voidItems.hasMore}
              isLoadingMore={voidItems.isLoadingMore}
              onLoadMore={() => voidItems.loadMore()}
            />
          )}
        </div>
      </div>
    </ReportsSalesLayout>
  );
}
