import { useMemo, useState } from "react";
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
import { filterReminderBills, getUniqueBillCategories, getUniqueBillDepartments } from "@/features/4_2_reminder-bills/utils/reminderBillsUtils";
import { buildReminderBillPayNowPrefill } from "@/features/4_2_reminder-bills/utils/reminderBillPayNowPrefill";
import { useReminderBillsData } from "../hooks/useReminderBillsData";
import { MobileReminderBillsTable } from "./MobileReminderBillsTable";
import { formatToRupiah } from "@/utils/formatCurrency";
import { AddNewExpenseModal } from "../../modal/AddNewExpenseModal";
import { useExpenses, type Expense } from "@/features/4_2_dashboard/hooks";

type BillFilters = {
  search: string;
  status: string;
  category: string;
  department: string;
};

export function BillsTableSection() {
  const { allBills, isLoading, refetch } = useReminderBillsData();
  const { updateRecurringBillAfterPayNow } = useExpenses();
  const [filtersDrawerOpen, setFiltersDrawerOpen] = useState(false);
  const [isPayNowModalOpen, setIsPayNowModalOpen] = useState(false);
  const [selectedPayNowBill, setSelectedPayNowBill] = useState<Expense | null>(null);
  const [filters, setFilters] = useState<BillFilters>({
    search: "",
    status: "all",
    category: "all",
    department: "all",
  });

  const categories = useMemo(() => getUniqueBillCategories(allBills), [allBills]);
  const departments = useMemo(() => getUniqueBillDepartments(allBills), [allBills]);

  const filteredBills = useMemo(() => filterReminderBills(allBills, filters), [allBills, filters]);
  const totalRecurringBills = useMemo(() => allBills.filter((expense) => expense.is_recurring).length, [allBills]);
  const totalAmount = useMemo(() => filteredBills.reduce((sum, bill) => sum + bill.amount, 0), [filteredBills]);

  const setFilter = (key: keyof BillFilters, value: string) => setFilters((prev) => ({ ...prev, [key]: value }));
  const clearFilters = () => setFilters({ search: "", status: "all", category: "all", department: "all" });
  const handlePayNow = (bill: Expense) => {
    setSelectedPayNowBill(bill);
    setIsPayNowModalOpen(true);
  };

  const payNowPrefillData = useMemo(
    () => (selectedPayNowBill ? buildReminderBillPayNowPrefill(selectedPayNowBill) : undefined),
    [selectedPayNowBill]
  );

  return (
    <div className="px-2 pt-4 pb-6">
      <Card className="w-full min-w-0 border border-border bg-card overflow-hidden">
        <CardContent className="p-0 flex flex-col min-w-0">
          <div className="px-1.5 py-1.5 border-b bg-muted/50 flex-shrink-0 min-w-0">
            <div className="flex items-center gap-1 min-w-0 w-full">
              <div className="relative flex-[1_1_auto] min-w-0">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4 pointer-events-none" />
                <Input
                  placeholder="Search bills..."
                  value={filters.search}
                  onChange={(e) => setFilter("search", e.target.value)}
                  className="pl-8 h-9 w-full min-w-0 pr-2 text-xs placeholder:text-xs"
                />
              </div>
              <Drawer open={filtersDrawerOpen} onOpenChange={setFiltersDrawerOpen}>
                <DrawerTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 w-auto gap-1 px-2 min-w-[88px] shrink-0">
                    <Filter className="h-4 w-4 flex-shrink-0" />
                    <span className="truncate">Filter</span>
                    <ChevronDown className="h-4 w-4 flex-shrink-0" />
                  </Button>
                </DrawerTrigger>
                <DrawerContent className="max-h-[85dvh] flex flex-col">
                  <DrawerHeader className="text-left pb-2 safe-area-top px-4 pt-4">
                    <DrawerTitle className="text-lg font-semibold">Filter</DrawerTitle>
                  </DrawerHeader>
                  <div className="overflow-y-auto overflow-x-hidden flex-1 min-h-0 px-4 pb-4 seamless-scroll">
                    <FilterGroup
                      title="Status"
                      current={filters.status}
                      options={[
                        { value: "all", label: "All Status" },
                        { value: "active", label: "Active" },
                        { value: "overdue", label: "Overdue" },
                        { value: "paid", label: "Paid" },
                        { value: "pending", label: "Pending" },
                      ]}
                      onSelect={(v) => setFilter("status", v)}
                    />
                    <FilterGroup
                      title="Category"
                      current={filters.category}
                      options={[{ value: "all", label: "All Categories" }, ...categories.map((c) => ({ value: c, label: c }))]}
                      onSelect={(v) => setFilter("category", v)}
                    />
                    <FilterGroup
                      title="Department"
                      current={filters.department}
                      options={[{ value: "all", label: "All Departments" }, ...departments.map((d) => ({ value: d, label: d }))]}
                      onSelect={(v) => setFilter("department", v)}
                    />
                  </div>
                  <div className="flex-shrink-0 border-t bg-muted/30 px-4 pt-3 pb-3 flex items-center justify-between gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={clearFilters}>Reset</Button>
                    <DrawerClose asChild><Button size="sm" className="min-w-[100px]">Done</Button></DrawerClose>
                  </div>
                </DrawerContent>
              </Drawer>
              <Button type="button" variant="outline" size="icon" className="h-9 w-9 flex-shrink-0" onClick={clearFilters} title="Reset filters">
                <FilterX className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="min-h-0 flex-1">
            <MobileReminderBillsTable bills={filteredBills} isLoading={isLoading} onPayNow={handlePayNow} />
          </div>

          <div className="flex-shrink-0 px-4 py-1 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>Showing {filteredBills.length} of {totalRecurringBills} bills{filters.status !== "all" ? ` in ${filters.status}` : ""}</span>
              <div className="flex flex-col items-end gap-0">
                <span className="text-xs text-gray-400 leading-tight">Total: {formatToRupiah(totalAmount)}</span>
                <span className="text-xs text-gray-400 leading-tight">{totalRecurringBills} bills</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <AddNewExpenseModal
        open={isPayNowModalOpen}
        onOpenChange={(next) => {
          setIsPayNowModalOpen(next);
          if (!next) setSelectedPayNowBill(null);
        }}
        prefillData={payNowPrefillData}
        onAfterCreateExpenseSuccess={async ({ linked_recurring_source_id, create_date }) => {
          if (!linked_recurring_source_id) return;
          await updateRecurringBillAfterPayNow(linked_recurring_source_id, create_date);
          await refetch();
        }}
      />
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
      <p className="text-xs font-medium text-muted-foreground mb-2">{title}</p>
      <div className="flex flex-col gap-0 rounded-md border bg-card">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onSelect(opt.value)}
            className={cn(
              "flex items-center justify-between w-full px-3 py-2.5 text-left text-sm border-b border-border last:border-b-0",
              current === opt.value ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted/50"
            )}
          >
            <span className="truncate">{opt.label}</span>
            {current === opt.value ? <Check className="h-4 w-4 text-primary flex-shrink-0" /> : null}
          </button>
        ))}
      </div>
    </div>
  );
}
