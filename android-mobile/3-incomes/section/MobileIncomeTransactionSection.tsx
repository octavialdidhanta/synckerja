import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Search, Filter, FilterX, ChevronDown, Check, X } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/shared/components/ui/drawer";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import type { IncomeTransactionWithRelations } from "@/4-1-dashboard/types";
import {
  getUniqueIncomeCategories,
  getUniqueIncomeTypes,
  type IncomeTransaction,
} from "@/4-1-transaction/utils/transactionUtils";
import type { IncomeTransactionPageModel } from "@/4-1-transaction/hooks/useIncomeTransactionPageModel";
import { useIncomeTransactionListController } from "@/4-1-transaction/hooks/useIncomeTransactionListController";
import { IncomeTransactionDialogsBundle } from "@/4-1-transaction/section/IncomeTransactionDialogsBundle";
import { IncomeDashboardRefreshContext } from "@/mobile/3-dashboard/IncomeDashboardRefreshContext";
import { MobileIncomeTransactionFullViewportOverlay } from "@/mobile/3-incomes/pages/MobileIncomeTransactionViewportSkeleton";
import { MobileIncomeTransactionDashboardCarousel } from "./MobileIncomeTransactionDashboardCarousel";
import { MobileIncomeTransactionTable } from "./MobileIncomeTransactionTable";
import { MobileIncomeTransactionTableFooter } from "./MobileIncomeTransactionTableFooter";
import { MobileAddIncomeTransactionModal } from "@/mobile/3-incomes/modal/MobileAddIncomeTransactionModal";
import { useIsMobile } from "@/mobile/shared/hooks/use-mobile";

type Stats = {
  isLoading: boolean;
  thisMonthRevenue: number;
  totalTransactions: number;
  thisYearRevenue: number;
  monthlyAverage: number;
  growthPercentage: number;
  currentMonthTransactionCount: number;
};

type Props = {
  model: IncomeTransactionPageModel;
  stats: Stats;
};

const SKELETON_MIN_MS = 200;

export function MobileIncomeTransactionSection({ model, stats }: Props) {
  const { t } = useAppTranslation();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const refreshCtx = useContext(IncomeDashboardRefreshContext);
  const refetchRef = refreshCtx?.refetchRef;
  const isRefreshing = refreshCtx?.isRefreshing ?? false;

  const [minSettleDone, setMinSettleDone] = useState(true);
  const skeletonShownAtRef = useRef<number | null>(null);
  const prevPending = useRef(false);

  const [filtersDrawerOpen, setFiltersDrawerOpen] = useState(false);
  const [searchExpanded, setSearchExpanded] = useState(false);

  const {
    filters,
    incomeTransactions,
    transactionsLoading,
    filteredTransactions,
    totalAmount,
    rawPendingLoad,
    handleRefresh,
    handleFilterChange,
    handleClearFilters,
  } = model;

  const listCtrl = useIncomeTransactionListController(handleRefresh);

  const typedTransactions = (incomeTransactions || []) as IncomeTransactionWithRelations[];
  const types = useMemo(
    () => getUniqueIncomeTypes(typedTransactions as unknown as IncomeTransaction[]),
    [typedTransactions],
  );
  const categories = useMemo(
    () => getUniqueIncomeCategories(typedTransactions as unknown as IncomeTransaction[]),
    [typedTransactions],
  );

  const invalidateIncome = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["income-metrics"] }),
      queryClient.invalidateQueries({ queryKey: ["income-transactions"] }),
      queryClient.invalidateQueries({ queryKey: ["bank-accounts"] }),
    ]);
  }, [queryClient]);

  useEffect(() => {
    if (!refetchRef) return;
    refetchRef.current = invalidateIncome;
    return () => {
      refetchRef.current = null;
    };
  }, [invalidateIncome, refetchRef]);

  useEffect(() => {
    const pending = rawPendingLoad;
    const wasPending = prevPending.current;
    prevPending.current = pending;

    if (pending) {
      if (skeletonShownAtRef.current == null) skeletonShownAtRef.current = Date.now();
      setMinSettleDone(false);
      return;
    }

    if (wasPending && skeletonShownAtRef.current != null) {
      const elapsed = Date.now() - skeletonShownAtRef.current;
      const remaining = Math.max(0, SKELETON_MIN_MS - elapsed);
      const tId = window.setTimeout(() => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setMinSettleDone(true);
            skeletonShownAtRef.current = null;
          });
        });
      }, remaining);
      return () => window.clearTimeout(tId);
    }

    skeletonShownAtRef.current = null;
    setMinSettleDone(true);
  }, [rawPendingLoad]);

  const showPageSkeleton = (rawPendingLoad || !minSettleDone) && !isRefreshing;

  const setFilter = (key: keyof typeof filters, value: string) => handleFilterChange(key, value);

  const drawerOverlay = "z-[100]";
  const drawerContentClass = "z-[100] max-h-[85dvh] flex flex-col";

  const footerTypeHint = filters.type !== "all" ? ` · ${filters.type}` : "";

  return (
    <div
      className={cn(
        "relative flex min-h-0 min-w-0 flex-1 flex-col gap-1",
        showPageSkeleton && "pointer-events-none invisible select-none",
      )}
      aria-hidden={showPageSkeleton}
    >
      <div className="shrink-0">
        <MobileIncomeTransactionDashboardCarousel
          isLoading={showPageSkeleton ? false : stats.isLoading}
          thisMonthRevenue={stats.thisMonthRevenue}
          totalTransactions={stats.totalTransactions}
          thisYearRevenue={stats.thisYearRevenue}
          monthlyAverage={stats.monthlyAverage}
          growthPercentage={stats.growthPercentage}
          currentMonthTransactionCount={stats.currentMonthTransactionCount}
        />
      </div>

      <Card
        className={cn(
          "flex min-h-0 min-w-0 w-full flex-col overflow-hidden border border-border bg-card",
          !isMobile && "flex-1",
        )}
      >
        <CardContent
          className={cn("flex min-h-0 min-w-0 flex-col p-0", !isMobile && "flex-1")}
        >
            <div className="min-w-0 flex-shrink-0 border-b border-border bg-muted/50 px-1.5 py-1.5">
              <div className="flex min-w-0 flex-nowrap items-center gap-1">
                <div
                  className={cn(
                    "relative flex min-w-0 items-center gap-1 transition-[max-width,flex-basis] duration-300 ease-in-out",
                    searchExpanded ? "max-w-full flex-[1_1_100%]" : "min-w-[100px] max-w-[220px] flex-1",
                  )}
                >
                  <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder={t("incomes.searchTransactions", "Search transactions...")}
                    value={filters.search}
                    onChange={(e) => setFilter("search", e.target.value)}
                    onFocus={() => setSearchExpanded(true)}
                    onBlur={() => setSearchExpanded(false)}
                    className="h-9 w-full min-w-0 pl-8 pr-8 text-xs placeholder:text-xs"
                  />
                  {searchExpanded ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 h-7 w-7 flex-shrink-0"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => setSearchExpanded(false)}
                      aria-label={t("common.close", "Close")}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>
                <div
                  className={cn(
                    "flex min-w-0 shrink flex-row-reverse flex-nowrap items-center gap-1 overflow-hidden transition-[max-width,opacity] duration-300 ease-in-out",
                    searchExpanded ? "pointer-events-none max-w-0 opacity-0" : "max-w-[320px] opacity-100",
                  )}
                >
                  <Button
                    type="button"
                    size="sm"
                    className="h-9 shrink-0 bg-brand-blue px-3 text-xs text-white hover:bg-brand-blue/90"
                    onClick={() => listCtrl.setIsAddDialogOpen(true)}
                  >
                    + {t("incomes.addIncome", "Add Income")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 flex-shrink-0"
                    onClick={handleClearFilters}
                    title={t("incomes.resetFilters", "Reset filters")}
                  >
                    <FilterX className="h-4 w-4" />
                  </Button>
                  <Drawer open={filtersDrawerOpen} onOpenChange={setFiltersDrawerOpen}>
                    <DrawerTrigger asChild>
                      <Button variant="outline" size="sm" className="h-9 min-w-[88px] shrink-0 gap-1 px-2">
                        <Filter className="h-4 w-4 shrink-0" />
                        <span className="truncate">{t("common.filter", "Filter")}</span>
                        <ChevronDown className="h-4 w-4 shrink-0" />
                      </Button>
                    </DrawerTrigger>
                    <DrawerContent overlayClassName={drawerOverlay} className={drawerContentClass}>
                      <DrawerHeader className="safe-area-top px-4 pb-2 pt-4 text-left">
                        <DrawerTitle className="text-lg font-semibold">
                          {t("incomes.filterTransactions", "Filter Transactions")}
                        </DrawerTitle>
                        <DrawerDescription className="sr-only">
                          {t("incomes.filterTransactions", "Filter Transactions")}
                        </DrawerDescription>
                      </DrawerHeader>
                      <div className="seamless-scroll min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-4 pb-4 scrollbar-hide [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                        <FilterGroup
                          title={t("incomes.period", "Period")}
                          current={filters.period}
                          options={[
                            { value: "all", label: t("incomes.periodAll", "All Time") },
                            { value: "this_month", label: t("incomes.thisMonth", "This Month") },
                            { value: "last_month", label: t("incomes.lastMonth", "Last Month") },
                            { value: "last_3_months", label: t("incomes.last3Months", "Last 3 Months") },
                            { value: "last_6_months", label: t("incomes.last6Months", "Last 6 Months") },
                            { value: "this_year", label: t("incomes.thisYear", "This Year") },
                            { value: "last_year", label: t("incomes.lastYear", "Last Year") },
                          ]}
                          onSelect={(v) => setFilter("period", v)}
                        />
                        <FilterGroup
                          title={t("incomes.status", "Status")}
                          current={filters.status}
                          options={[
                            { value: "all", label: t("incomes.allStatus", "All Status") },
                            { value: "completed", label: t("incomes.completed", "Completed") },
                            { value: "pending", label: t("incomes.pending", "Pending") },
                            { value: "cancelled", label: t("incomes.cancelled", "Cancelled") },
                          ]}
                          onSelect={(v) => setFilter("status", v)}
                        />
                        <FilterGroup
                          title={t("incomes.type", "Type")}
                          current={filters.type}
                          options={[
                            { value: "all", label: t("incomes.allTypes", "All Types") },
                            ...types.map((v) => ({ value: v, label: v })),
                          ]}
                          onSelect={(v) => setFilter("type", v)}
                        />
                        <FilterGroup
                          title={t("incomes.category", "Category")}
                          current={filters.category}
                          options={[
                            { value: "all", label: t("incomes.allCategories", "All Categories") },
                            ...categories.map((v) => ({ value: v, label: v })),
                          ]}
                          onSelect={(v) => setFilter("category", v)}
                        />
                      </div>
                      <div className="flex flex-shrink-0 items-center justify-between gap-2 border-t bg-muted/30 px-4 pb-3 pt-3">
                        <Button type="button" variant="outline" size="sm" onClick={handleClearFilters}>
                          {t("common.reset", "Reset")}
                        </Button>
                        <DrawerClose asChild>
                          <Button type="button" size="sm" className="min-w-[100px]">
                            {t("common.done", "Done")}
                          </Button>
                        </DrawerClose>
                      </div>
                    </DrawerContent>
                  </Drawer>
                </div>
              </div>
            </div>

            <div
              className={cn(
                "min-h-0 min-w-0",
                isMobile ? "shrink-0" : "flex min-h-0 min-w-0 flex-1 flex-col",
              )}
            >
              <MobileIncomeTransactionTable
                transactions={filteredTransactions as IncomeTransactionWithRelations[]}
                isLoading={showPageSkeleton ? false : transactionsLoading}
                onView={listCtrl.handleViewDetails}
                onEdit={listCtrl.handleEdit}
                onDelete={listCtrl.handleDelete}
              />
            </div>

            <MobileIncomeTransactionTableFooter
              filteredCount={filteredTransactions.length}
              totalCount={typedTransactions.length}
              totalAmount={totalAmount}
              extraHint={footerTypeHint}
            />
          </CardContent>
        </Card>

      <MobileAddIncomeTransactionModal
        open={listCtrl.isAddDialogOpen}
        onOpenChange={listCtrl.setIsAddDialogOpen}
        onSuccess={() => void handleRefresh()}
      />
      <IncomeTransactionDialogsBundle ctrl={listCtrl} onRefresh={handleRefresh} omitAddDialog />

      {showPageSkeleton &&
        typeof document !== "undefined" &&
        createPortal(<MobileIncomeTransactionFullViewportOverlay />, document.body)}
    </div>
  );
}

function FilterGroup({
  title,
  current,
  options,
  onSelect,
}: {
  title: string;
  current: string;
  options: { value: string; label: string }[];
  onSelect: (value: string) => void;
}) {
  return (
    <div className="mb-4">
      <p className="mb-2 text-xs font-medium text-muted-foreground">{title}</p>
      <div className="flex flex-col gap-0 rounded-md border bg-card">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onSelect(opt.value)}
            className={cn(
              "flex w-full items-center justify-between border-b border-border px-3 py-2.5 text-left text-sm last:border-b-0",
              current === opt.value ? "bg-primary/10 font-medium text-primary" : "hover:bg-muted/50",
            )}
          >
            <span className="truncate">{opt.label}</span>
            {current === opt.value ? <Check className="h-4 w-4 flex-shrink-0 text-primary" /> : null}
          </button>
        ))}
      </div>
    </div>
  );
}
