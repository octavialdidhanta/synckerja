import { useMemo, useState } from "react";
import { cn } from "@/shared/lib/utils";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import type { PurchaseRequest } from "@/9-request-form/hooks/usePurchaseRequests";
import type { ApprovalFiltersType } from "@/4-2-approvals/section/ApprovalFilters";
import { filterRequests, getUniqueDepartments } from "@/4-2-approvals/utils/approvalUtils";
import { ApprovalTable } from "@/4-2-approvals/section/ApprovalTable";
import { Card, CardContent } from "@/mobile-app/components/ui/card";
import { Button } from "@/mobile-app/components/ui/button";
import { Input } from "@/mobile-app/components/ui/input";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/mobile-app/components/ui/drawer";
import { Check, ChevronDown, Filter, FilterX, Search } from "lucide-react";

const SCROLL_HIDE =
  "scrollbar-hide [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

interface ApprovalsTableSectionProps {
  requests: PurchaseRequest[];
  isLoading: boolean;
  filters: ApprovalFiltersType;
  onFilterChange: (key: keyof ApprovalFiltersType, value: string) => void;
  onClearFilters: () => void;
}

export function ApprovalsTableSection({
  requests,
  isLoading,
  filters,
  onFilterChange,
  onClearFilters,
}: ApprovalsTableSectionProps) {
  const { t } = useAppTranslation();
  const [filtersDrawerOpen, setFiltersDrawerOpen] = useState(false);

  const departmentOptions = useMemo(() => getUniqueDepartments(requests), [requests]);

  const filteredRequests = useMemo(() => filterRequests(requests, filters), [requests, filters]);

  const hasActiveFilters =
    Boolean(filters.search) ||
    filters.status !== "all" ||
    filters.type !== "all" ||
    filters.department !== "all";

  const filterSummary =
    filters.status !== "all"
      ? filters.status
      : filters.type !== "all"
        ? filters.type
        : filters.department !== "all"
          ? filters.department
          : t("expenses.filtersDrawerTitle", "Filter");

  return (
    <div className="min-w-0 w-full">
      <Card className="w-full min-w-0 overflow-hidden border border-border bg-card">
        <CardContent className="flex min-w-0 flex-col p-0">
          <div className="min-w-0 flex-shrink-0 border-b bg-muted/50 px-1.5 py-1.5">
            <div className="flex w-full min-w-0 items-center gap-1">
              <div className="relative min-h-9 min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-2 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  enterKeyHint="search"
                  autoComplete="off"
                  placeholder={t("approvals.searchPlaceholder", "Search requests...")}
                  value={filters.search}
                  onChange={(e) => onFilterChange("search", e.target.value)}
                  className={cn(
                    "h-9 min-w-0 border-border pr-2 pl-8 text-sm",
                    "focus-visible:border-brand-blue focus-visible:ring-brand-blue/30",
                  )}
                />
              </div>
              <Drawer open={filtersDrawerOpen} onOpenChange={setFiltersDrawerOpen}>
                <DrawerTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 min-w-0 shrink-0 gap-1 px-2">
                    <Filter className="h-4 w-4 shrink-0" />
                    <span className="max-w-[4.5rem] truncate sm:max-w-none">
                      {t("expenses.filtersDrawerTitle", "Filter")}
                    </span>
                    <ChevronDown className="h-4 w-4 shrink-0" />
                  </Button>
                </DrawerTrigger>
                <DrawerContent className="flex max-h-[85dvh] flex-col">
                  <DrawerHeader className="safe-area-top px-4 pb-2 pt-4 text-left">
                    <DrawerTitle className="text-lg font-semibold">
                      {t("expenses.filtersDrawerTitle", "Filter")}
                    </DrawerTitle>
                  </DrawerHeader>
                  <div
                    className={cn(
                      "min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-4 pb-4 seamless-scroll",
                      SCROLL_HIDE,
                    )}
                  >
                    <div className="mb-4">
                      <p className="mb-2 text-xs font-medium text-muted-foreground">
                        {t("approvals.filters.status", "Status")}
                      </p>
                      <div className="flex flex-col gap-0 rounded-md border bg-card">
                        {(
                          [
                            { key: "all", label: t("approvals.filters.allStatus", "All Status") },
                            { key: "pending_approval", label: t("approvals.filters.pending", "Pending") },
                            { key: "submitted", label: t("approvals.filters.submitted", "Submitted") },
                            { key: "approved", label: t("approvals.status.approved", "Approved") },
                            { key: "rejected", label: t("approvals.status.rejected", "Rejected") },
                          ] as const
                        ).map((row) => (
                          <button
                            key={row.key}
                            type="button"
                            onClick={() => onFilterChange("status", row.key)}
                            className={cn(
                              "flex w-full items-center justify-between border-b border-border px-3 py-2.5 text-left text-sm last:border-b-0",
                              filters.status === row.key
                                ? "bg-primary/10 font-medium text-primary"
                                : "hover:bg-muted/50",
                            )}
                          >
                            <span>{row.label}</span>
                            {filters.status === row.key ? (
                              <Check className="h-4 w-4 shrink-0 text-primary" />
                            ) : null}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="mb-4">
                      <p className="mb-2 text-xs font-medium text-muted-foreground">
                        {t("approvals.table.type", "Type")}
                      </p>
                      <div className="flex flex-col gap-0 rounded-md border bg-card">
                        {(
                          [
                            { key: "all", label: t("approvals.filters.allTypes", "All Types") },
                            { key: "purchase", label: t("approvals.type.purchase", "Purchase") },
                            { key: "reimbursement", label: t("approvals.type.reimbursement", "Reimbursement") },
                          ] as const
                        ).map((row) => (
                          <button
                            key={row.key}
                            type="button"
                            onClick={() => onFilterChange("type", row.key)}
                            className={cn(
                              "flex w-full items-center justify-between border-b border-border px-3 py-2.5 text-left text-sm last:border-b-0",
                              filters.type === row.key
                                ? "bg-primary/10 font-medium text-primary"
                                : "hover:bg-muted/50",
                            )}
                          >
                            <span>{row.label}</span>
                            {filters.type === row.key ? (
                              <Check className="h-4 w-4 shrink-0 text-primary" />
                            ) : null}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="mb-4">
                      <p className="mb-2 text-xs font-medium text-muted-foreground">
                        {t("approvals.table.department", "Department")}
                      </p>
                      <div className="flex flex-col gap-0 rounded-md border bg-card">
                        <button
                          type="button"
                          onClick={() => onFilterChange("department", "all")}
                          className={cn(
                            "flex w-full items-center justify-between border-b border-border px-3 py-2.5 text-left text-sm",
                            filters.department === "all"
                              ? "bg-primary/10 font-medium text-primary"
                              : "hover:bg-muted/50",
                          )}
                        >
                          <span>{t("approvals.filters.allDepartments", "All Departments")}</span>
                          {filters.department === "all" ? (
                            <Check className="h-4 w-4 shrink-0 text-primary" />
                          ) : null}
                        </button>
                        {departmentOptions.map((dept) => (
                          <button
                            key={dept}
                            type="button"
                            onClick={() => onFilterChange("department", dept)}
                            className={cn(
                              "flex w-full items-center justify-between border-b border-border px-3 py-2.5 text-left text-sm last:border-b-0",
                              filters.department === dept
                                ? "bg-primary/10 font-medium text-primary"
                                : "hover:bg-muted/50",
                            )}
                          >
                            <span className="truncate">{dept}</span>
                            {filters.department === dept ? (
                              <Check className="h-4 w-4 shrink-0 text-primary" />
                            ) : null}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-shrink-0 items-center justify-between gap-2 border-t bg-muted/30 px-4 pb-3 pt-3">
                    <Button type="button" variant="outline" size="sm" onClick={onClearFilters}>
                      {t("expenses.refreshFilters", "Reset")}
                    </Button>
                    <DrawerClose asChild>
                      <Button size="sm" className="min-w-[100px]">
                        {t("common.done", "Done")}
                      </Button>
                    </DrawerClose>
                  </div>
                </DrawerContent>
              </Drawer>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={onClearFilters}
                disabled={!hasActiveFilters}
                title={t("expenses.refreshFilters", "Reset filters")}
              >
                <FilterX className="h-4 w-4" />
              </Button>
            </div>
            {hasActiveFilters ? (
              <p className="mt-1 truncate px-0.5 text-[10px] text-muted-foreground" title={filterSummary}>
                {filterSummary}
              </p>
            ) : null}
          </div>

          <div className="min-h-0 min-w-0 flex-1">
            <ApprovalTable
              requests={filteredRequests}
              isLoading={isLoading}
              variant="mobileCard"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
