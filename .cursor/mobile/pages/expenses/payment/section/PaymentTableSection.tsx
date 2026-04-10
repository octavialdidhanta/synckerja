import { useMemo, useState } from "react";
import { format, endOfDay, endOfMonth, endOfWeek, endOfYear, isWithinInterval, startOfDay, startOfMonth, startOfWeek, startOfYear, subMonths, subYears } from "date-fns";
import { Search, Filter, FilterX, ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/mobile/components/ui/card";
import { Button } from "@/mobile/components/ui/button";
import { Input } from "@/mobile/components/ui/input";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/mobile/components/ui/drawer";
import { usePurchaseRequests } from "@/features/9_request-form/hooks/usePurchaseRequests";
import { MobilePaymentTable } from "./MobilePaymentTable";
import { CustomDatePicker } from "@/mobile/components/CustomDatePicker";
import { useAppTranslation } from "@/features/share/i18n/useAppTranslation";

export function PaymentTableSection() {
  const { t } = useAppTranslation();
  const { data: requests = [], isLoading, refetch } = usePurchaseRequests();
  const [filtersDrawerOpen, setFiltersDrawerOpen] = useState(false);
  const [isCustomDatePickerOpen, setIsCustomDatePickerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState<
    "all-dates" | "today" | "yesterday" | "this-week" | "this-month" | "last-month" | "3-months-ago" | "6-months-ago" | "this-year" | "last-year" | "custom"
  >("this-month");
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>(undefined);
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");

  const uniqueDepartments = useMemo(() => {
    return Array.from(
      new Set(
        requests
          .map((r) => r.department_name)
          .filter((v): v is string => !!v && v.trim().length > 0)
      )
    ).sort();
  }, [requests]);

  const filteredRequests = useMemo(() => {
    const now = new Date();
    const dateInSelectedRange = (sourceDate: string | null | undefined) => {
      if (!sourceDate || dateFilter === "all-dates") return true;
      const d = new Date(sourceDate);
      if (Number.isNaN(d.getTime())) return false;

      switch (dateFilter) {
        case "today":
          return isWithinInterval(d, { start: startOfDay(now), end: endOfDay(now) });
        case "yesterday": {
          const y = new Date(now);
          y.setDate(y.getDate() - 1);
          return isWithinInterval(d, { start: startOfDay(y), end: endOfDay(y) });
        }
        case "this-week":
          return isWithinInterval(d, { start: startOfWeek(now), end: endOfWeek(now) });
        case "this-month":
          return isWithinInterval(d, { start: startOfMonth(now), end: endOfMonth(now) });
        case "last-month": {
          const lm = subMonths(now, 1);
          return isWithinInterval(d, { start: startOfMonth(lm), end: endOfMonth(lm) });
        }
        case "3-months-ago": {
          const from = startOfMonth(subMonths(now, 3));
          return isWithinInterval(d, { start: from, end: endOfDay(now) });
        }
        case "6-months-ago": {
          const from = startOfMonth(subMonths(now, 6));
          return isWithinInterval(d, { start: from, end: endOfDay(now) });
        }
        case "this-year":
          return isWithinInterval(d, { start: startOfYear(now), end: endOfYear(now) });
        case "last-year": {
          const ly = subYears(now, 1);
          return isWithinInterval(d, { start: startOfYear(ly), end: endOfYear(ly) });
        }
        case "custom":
          if (!customStartDate || !customEndDate) return true;
          return isWithinInterval(d, { start: startOfDay(customStartDate), end: endOfDay(customEndDate) });
        default:
          return true;
      }
    };

    return requests.filter((request) => {
      const isPaymentRequest = request.status === "approved";
      if (!isPaymentRequest) return false;

      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesSearch =
          request.request_title?.toLowerCase().includes(q) ||
          request.description?.toLowerCase().includes(q) ||
          request.requester_name?.toLowerCase().includes(q) ||
          request.department_name?.toLowerCase().includes(q);
        if (!matchesSearch) return false;
      }

      if (statusFilter !== "all") {
        const effectiveStatus = request.paid_at || request.payment_status === "paid"
          ? "paid"
          : request.payment_status === "processing"
            ? "processing"
            : "pending";
        if (effectiveStatus !== statusFilter) return false;
      }

      if (typeFilter !== "all") {
        if (typeFilter === "purchase" && request.request_type !== "purchase") return false;
        if (typeFilter === "reimbursement" && request.request_type !== "reimbursement") return false;
      }

      if (departmentFilter !== "all") {
        if (request.department_name?.toLowerCase() !== departmentFilter.toLowerCase()) return false;
      }

      const effectiveDate = request.paid_at || request.approved_at || request.created_at;
      if (!dateInSelectedRange(effectiveDate)) return false;

      return true;
    });
  }, [requests, searchQuery, dateFilter, customStartDate, customEndDate, statusFilter, typeFilter, departmentFilter]);

  const clearFilters = () => {
    setSearchQuery("");
    setDateFilter("all-dates");
    setCustomStartDate(undefined);
    setCustomEndDate(undefined);
    setStatusFilter("all");
    setTypeFilter("all");
    setDepartmentFilter("all");
  };

  return (
    <div className="px-2 pt-4 pb-6">
      <Card className="w-full min-w-0 border border-border bg-card overflow-hidden">
        <CardContent className="p-0 flex flex-col min-w-0">
          <div className="px-1.5 py-1.5 border-b bg-muted/50 flex-shrink-0 min-w-0">
            <div className="flex items-center gap-1 min-w-0 w-full">
              <div className="relative flex-[1_1_auto] min-w-0">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4 pointer-events-none" />
                <Input
                  placeholder="Search payments..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-9 w-full min-w-0 pr-2 text-xs placeholder:text-xs"
                />
              </div>
              <Drawer open={filtersDrawerOpen} onOpenChange={setFiltersDrawerOpen}>
                <DrawerTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 w-auto gap-1 px-2 min-w-[88px] shrink-0">
                    <Filter className="h-4 w-4 flex-shrink-0" />
                    <span className="truncate">
                      {dateFilter === "custom" && customStartDate && customEndDate
                        ? `${format(customStartDate, "MMM d")}-${format(customEndDate, "MMM d")}`
                        : dateFilter === "all-dates"
                          ? t("expenses.dateFilter.allDates", "All Dates")
                          : dateFilter === "this-month"
                            ? t("expenses.dateFilter.thisMonth", "This Month")
                            : dateFilter === "this-year"
                              ? t("expenses.dateFilter.thisYear", "This Year")
                              : dateFilter === "today"
                                ? t("expenses.dateFilter.today", "Today")
                                : dateFilter === "yesterday"
                                  ? t("expenses.dateFilter.yesterday", "Yesterday")
                                  : dateFilter === "this-week"
                                    ? t("expenses.dateFilter.thisWeek", "This Week")
                                    : dateFilter === "last-month"
                                      ? t("expenses.dateFilter.lastMonth", "Last Month")
                                      : dateFilter === "last-year"
                                        ? t("expenses.dateFilter.lastYear", "Last Year")
                                        : t("expenses.filtersDrawerTitle", "Filter")}
                    </span>
                    <ChevronDown className="h-4 w-4 flex-shrink-0" />
                  </Button>
                </DrawerTrigger>
                <DrawerContent className="max-h-[85dvh] flex flex-col">
                  <DrawerHeader className="text-left pb-2 safe-area-top px-4 pt-4">
                    <DrawerTitle className="text-lg font-semibold">Filter</DrawerTitle>
                  </DrawerHeader>
                  <div className="overflow-y-auto overflow-x-hidden flex-1 min-h-0 px-4 pb-4 seamless-scroll">
                    <div className="mb-4">
                      <p className="text-xs font-medium text-muted-foreground mb-2">Date</p>
                      <div className="flex flex-col gap-0 rounded-md border bg-card">
                        {[
                          { value: "all-dates" as const, label: t("expenses.dateFilter.allDates", "All Dates") },
                          { value: "today" as const, label: t("expenses.dateFilter.today", "Today") },
                          { value: "yesterday" as const, label: t("expenses.dateFilter.yesterday", "Yesterday") },
                          { value: "this-week" as const, label: t("expenses.dateFilter.thisWeek", "This Week") },
                          { value: "this-month" as const, label: t("expenses.dateFilter.thisMonth", "This Month") },
                          { value: "last-month" as const, label: t("expenses.dateFilter.lastMonth", "Last Month") },
                          { value: "3-months-ago" as const, label: t("expenses.dateFilter.3MonthsAgo", "3 Months Ago") },
                          { value: "6-months-ago" as const, label: t("expenses.dateFilter.6MonthsAgo", "6 Months Ago") },
                          { value: "this-year" as const, label: t("expenses.dateFilter.thisYear", "This Year") },
                          { value: "last-year" as const, label: t("expenses.dateFilter.lastYear", "Last Year") },
                          { value: "custom" as const, label: t("expenses.dateFilter.customRange", "Custom Range") },
                        ].map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => {
                              if (opt.value === "custom") {
                                setIsCustomDatePickerOpen(true);
                                setFiltersDrawerOpen(false);
                              } else {
                                setDateFilter(opt.value);
                                setCustomStartDate(undefined);
                                setCustomEndDate(undefined);
                              }
                            }}
                            className={cn(
                              "flex items-center justify-between w-full px-3 py-2.5 text-left text-sm border-b border-border last:border-b-0",
                              dateFilter === opt.value ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted/50"
                            )}
                          >
                            <span>{opt.label}</span>
                            {dateFilter === opt.value ? <Check className="h-4 w-4 text-primary" /> : null}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="mb-4">
                      <p className="text-xs font-medium text-muted-foreground mb-2">Status</p>
                      <div className="flex flex-col gap-0 rounded-md border bg-card">
                        {[
                          { value: "all", label: "All Status" },
                          { value: "pending", label: "Pending" },
                          { value: "processing", label: "Processing" },
                          { value: "paid", label: "Paid" },
                        ].map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setStatusFilter(opt.value)}
                            className={cn(
                              "flex items-center justify-between w-full px-3 py-2.5 text-left text-sm border-b border-border last:border-b-0",
                              statusFilter === opt.value ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted/50"
                            )}
                          >
                            <span>{opt.label}</span>
                            {statusFilter === opt.value ? <Check className="h-4 w-4 text-primary" /> : null}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="mb-4">
                      <p className="text-xs font-medium text-muted-foreground mb-2">Type</p>
                      <div className="flex flex-col gap-0 rounded-md border bg-card">
                        {[
                          { value: "all", label: "All Types" },
                          { value: "purchase", label: "Purchase" },
                          { value: "reimbursement", label: "Reimbursement" },
                        ].map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setTypeFilter(opt.value)}
                            className={cn(
                              "flex items-center justify-between w-full px-3 py-2.5 text-left text-sm border-b border-border last:border-b-0",
                              typeFilter === opt.value ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted/50"
                            )}
                          >
                            <span>{opt.label}</span>
                            {typeFilter === opt.value ? <Check className="h-4 w-4 text-primary" /> : null}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="mb-4">
                      <p className="text-xs font-medium text-muted-foreground mb-2">Department</p>
                      <div className="flex flex-col gap-0 rounded-md border bg-card">
                        <button
                          type="button"
                          onClick={() => setDepartmentFilter("all")}
                          className={cn(
                            "flex items-center justify-between w-full px-3 py-2.5 text-left text-sm border-b border-border",
                            departmentFilter === "all" ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted/50"
                          )}
                        >
                          <span>All Departments</span>
                          {departmentFilter === "all" ? <Check className="h-4 w-4 text-primary" /> : null}
                        </button>
                        {uniqueDepartments.map((dept) => (
                          <button
                            key={dept}
                            type="button"
                            onClick={() => setDepartmentFilter(dept)}
                            className={cn(
                              "flex items-center justify-between w-full px-3 py-2.5 text-left text-sm border-b border-border last:border-b-0",
                              departmentFilter === dept ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted/50"
                            )}
                          >
                            <span className="truncate">{dept}</span>
                            {departmentFilter === dept ? <Check className="h-4 w-4 text-primary" /> : null}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex-shrink-0 border-t bg-muted/30 px-4 pt-3 pb-3 flex items-center justify-between gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={clearFilters}>
                      Reset
                    </Button>
                    <DrawerClose asChild>
                      <Button size="sm" className="min-w-[100px]">Done</Button>
                    </DrawerClose>
                  </div>
                </DrawerContent>
              </Drawer>
              <Button type="button" variant="outline" size="icon" className="h-9 w-9 flex-shrink-0" onClick={clearFilters} title="Reset filters">
                <FilterX className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="min-h-0 flex-1">
            <MobilePaymentTable requests={filteredRequests} isLoading={isLoading} onRefresh={() => refetch()} />
          </div>
        </CardContent>
      </Card>

      <CustomDatePicker
        isOpen={isCustomDatePickerOpen}
        onClose={() => setIsCustomDatePickerOpen(false)}
        onDateRangeSelect={(startDate, endDate) => {
          setCustomStartDate(startDate);
          setCustomEndDate(endDate);
          setDateFilter("custom");
          setIsCustomDatePickerOpen(false);
        }}
        initialStartDate={customStartDate}
        initialEndDate={customEndDate}
      />
    </div>
  );
}
