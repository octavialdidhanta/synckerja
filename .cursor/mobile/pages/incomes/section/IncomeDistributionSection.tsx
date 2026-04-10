import { useMemo, useState } from "react";
import { Card, CardContent } from "@/mobile/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/mobile/components/ui/tabs";
import { Button } from "@/mobile/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/mobile/components/ui/drawer";
import { Check, ChevronDown } from "lucide-react";
import { formatToRupiah } from "@/utils/formatCurrency";
import { useIncomeTransactions } from "@/features/4-1-dashboard/hooks/useIncomeTransactions";
import { useIncomeMasterData } from "@/features/4-1-dashboard/hooks/useIncomeMasterData";
import { useMonthlyIncomeData } from "@/features/4-1-dashboard/hooks/useMonthlyIncomeData";
import { useBankAccounts } from "@/hooks/organized/useBankAccounts";
import { cn } from "@/lib/utils";
import { IncomeMonthlyTrendChart } from "./IncomeMonthlyTrendChart";
import { useAppTranslation } from "@/features/share/i18n/useAppTranslation";

const getDateRangeForPeriod = (period: string): { startDate: Date; endDate: Date } => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const currentDate = now.getDate();

  let startDate: Date;
  let endDate: Date = new Date(currentYear, currentMonth, currentDate + 1);

  switch (period) {
    case "This Month":
      startDate = new Date(currentYear, currentMonth, 1);
      break;
    case "Last Month": {
      const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
      startDate = new Date(lastMonthYear, lastMonth, 1);
      endDate = new Date(currentYear, currentMonth, 1);
      break;
    }
    case "Last 3 Months":
      startDate = new Date(currentYear, currentMonth - 3, 1);
      break;
    case "Last 6 Months":
      startDate = new Date(currentYear, currentMonth - 6, 1);
      break;
    case "This Year":
      startDate = new Date(currentYear, 0, 1);
      break;
    case "Last Year":
      startDate = new Date(currentYear - 1, 0, 1);
      endDate = new Date(currentYear, 0, 1);
      break;
    default:
      startDate = new Date(currentYear, currentMonth, 1);
  }
  return { startDate, endDate };
};

const formatDateToString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

interface IncomeDistributionSectionProps {
  selectedPeriod?: string;
  onSelectedPeriodChange?: (value: string) => void;
}

export function IncomeDistributionSection({
  selectedPeriod: selectedPeriodProp,
  onSelectedPeriodChange,
}: IncomeDistributionSectionProps = {}) {
  const { t } = useAppTranslation();
  const [internalSelectedPeriod, setInternalSelectedPeriod] = useState("This Month");
  const [selectedType, setSelectedType] = useState("All Types");
  const [selectedBankAccount, setSelectedBankAccount] = useState<string>("all");
  const [tab, setTab] = useState<"overview" | "service" | "monthly">("overview");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [periodDrawerOpen, setPeriodDrawerOpen] = useState(false);
  const [typeDrawerOpen, setTypeDrawerOpen] = useState(false);
  const [bankDrawerOpen, setBankDrawerOpen] = useState(false);
  const [yearDrawerOpen, setYearDrawerOpen] = useState(false);
  const selectedPeriod = selectedPeriodProp ?? internalSelectedPeriod;
  const setSelectedPeriod = (value: string) => {
    setInternalSelectedPeriod(value);
    onSelectedPeriodChange?.(value);
  };

  const { incomeTransactions, isLoading } = useIncomeTransactions();
  const { incomeTypes } = useIncomeMasterData();
  const { data: monthlyData = [], isLoading: monthlyLoading } = useMonthlyIncomeData(selectedYear);
  const { bankAccounts, loading: bankAccountsLoading } = useBankAccounts();
  const monthlyChartData = useMemo(
    () => monthlyData.map((item) => ({ month: item.shortMonth, amount: item.value })),
    [monthlyData]
  );

  const hasTransactionsWithoutType = useMemo(
    () => incomeTransactions.some((t) => !t.income_types?.name),
    [incomeTransactions]
  );

  const filteredTransactions = useMemo(() => {
    if (!incomeTransactions.length) return [];
    const { startDate, endDate } = getDateRangeForPeriod(selectedPeriod);
    const startDateStr = formatDateToString(startDate);
    const endDateStr = formatDateToString(endDate);

    return incomeTransactions.filter((transaction) => {
      const transactionDate = transaction.transaction_date;
      const isInDateRange = transactionDate >= startDateStr && transactionDate < endDateStr;

      const transactionType = transaction.income_types?.name || "";
      let matchesType = true;
      if (selectedType === "All Types") matchesType = true;
      else if (selectedType === "Other") matchesType = !transactionType;
      else matchesType = transactionType === selectedType;

      const matchesBankAccount =
        selectedBankAccount === "all" ? true : transaction.bank_account_id === selectedBankAccount;

      const isValidStatus = transaction.status === "completed" || transaction.status === "pending";
      return isInDateRange && matchesType && matchesBankAccount && isValidStatus;
    });
  }, [incomeTransactions, selectedPeriod, selectedType, selectedBankAccount]);

  const totalIncome = useMemo(
    () => filteredTransactions.reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0),
    [filteredTransactions]
  );

  const periodOptions = ["This Month", "Last Month", "Last 3 Months", "Last 6 Months", "This Year", "Last Year"];
  const periodLabelMap: Record<string, string> = {
    "This Month": t("expenses.dateFilter.thisMonth", "This Month"),
    "Last Month": t("expenses.dateFilter.lastMonth", "Last Month"),
    "Last 3 Months": t("incomes.distribution.last3Months", "Last 3 Months"),
    "Last 6 Months": t("incomes.distribution.last6Months", "Last 6 Months"),
    "This Year": t("incomes.distribution.thisYear", "This Year"),
    "Last Year": t("incomes.distribution.lastYear", "Last Year"),
  };
  const selectedPeriodLabel = periodLabelMap[selectedPeriod] ?? selectedPeriod;
  const typeOptions = useMemo(() => {
    const names = incomeTypes.map((type) => type.name).filter(Boolean);
    if (hasTransactionsWithoutType && !names.includes("Other")) {
      names.push("Other");
    }
    return ["All Types", ...names];
  }, [incomeTypes, hasTransactionsWithoutType]);
  const selectedTypeLabel =
    selectedType === "All Types"
      ? t("expenses.expenseTypeFilter.allTypes", "All Types")
      : selectedType === "Other"
        ? t("incomes.distribution.other", "Other")
        : selectedType;
  const bankOptions = [
    { value: "all", label: t("incomes.distribution.allBankAccounts", "All Bank Accounts") },
    ...bankAccounts.map((bank) => ({
      value: bank.id,
      label: bank.account_number ? `${bank.name} - ${bank.account_number}` : bank.name,
    })),
  ];

  const bars = useMemo(() => {
    const source =
      tab === "overview"
        ? filteredTransactions.reduce((acc, trx) => {
            const key = trx.income_types?.name || t("incomes.distribution.uncategorized", "Uncategorized");
            const amount = parseFloat(trx.amount.toString());
            acc[key] = (acc[key] || 0) + amount;
            return acc;
          }, {} as Record<string, number>)
        : filteredTransactions.reduce((acc, trx) => {
            const key = trx.services?.name || t("incomes.distribution.uncategorized", "Uncategorized");
            const amount = parseFloat(trx.amount.toString());
            acc[key] = (acc[key] || 0) + amount;
            return acc;
          }, {} as Record<string, number>);

    const entries = Object.entries(source);
    const maxAmount = entries.length > 0 ? Math.max(...entries.map(([, v]) => v)) : 0;
    const colors = [
      "bg-green-500",
      "bg-green-400",
      "bg-blue-500",
      "bg-blue-400",
      "bg-purple-500",
      "bg-purple-400",
      "bg-orange-500",
      "bg-orange-400",
    ];

    return entries.map(([name, amount], index) => ({
      name,
      amount,
      heightPercentage: maxAmount > 0 ? (amount / maxAmount) * 80 : 0,
      colorClass: colors[index % colors.length],
    }));
  }, [filteredTransactions, tab, t]);

  return (
    <div className="px-2 pt-1 pb-1">
      <Card className="w-full min-w-0 border border-border bg-card overflow-hidden">
        <CardContent className="p-0 flex flex-col min-w-0">
          <div className="px-2 py-2 border-b bg-muted/50 flex-shrink-0 min-w-0 grid grid-cols-3 gap-2">
            <Drawer open={periodDrawerOpen} onOpenChange={setPeriodDrawerOpen}>
              <DrawerTrigger asChild>
                <Button variant="outline" className="h-9 w-full justify-between text-xs px-2">
                  <span className="truncate">{selectedPeriodLabel}</span>
                  <ChevronDown className="h-4 w-4 flex-shrink-0" />
                </Button>
              </DrawerTrigger>
              <DrawerContent className="max-h-[85dvh] flex flex-col">
                <DrawerHeader className="text-left pb-2 safe-area-top px-4 pt-4">
                  <DrawerTitle className="text-base font-semibold">{t("incomes.distribution.period", "Period")}</DrawerTitle>
                  <DrawerDescription className="sr-only">{t("incomes.distribution.selectPeriodFilter", "Select period filter")}</DrawerDescription>
                </DrawerHeader>
                <div className="overflow-y-auto overflow-x-hidden flex-1 min-h-0 px-4 pb-4 seamless-scroll">
                  {periodOptions.map((opt) => (
                    <FilterItem
                      key={opt}
                      label={periodLabelMap[opt] ?? opt}
                      active={selectedPeriod === opt}
                      onClick={() => {
                        setSelectedPeriod(opt);
                        setPeriodDrawerOpen(false);
                      }}
                    />
                  ))}
                </div>
              </DrawerContent>
            </Drawer>

            <Drawer open={typeDrawerOpen} onOpenChange={setTypeDrawerOpen}>
              <DrawerTrigger asChild>
                <Button variant="outline" className="h-9 w-full justify-between text-xs px-2">
                  <span className="truncate">{selectedTypeLabel}</span>
                  <ChevronDown className="h-4 w-4 flex-shrink-0" />
                </Button>
              </DrawerTrigger>
              <DrawerContent className="max-h-[85dvh] flex flex-col">
                <DrawerHeader className="text-left pb-2 safe-area-top px-4 pt-4">
                  <DrawerTitle className="text-base font-semibold">{t("incomes.distribution.type", "Type")}</DrawerTitle>
                  <DrawerDescription className="sr-only">{t("incomes.distribution.selectIncomeTypeFilter", "Select income type filter")}</DrawerDescription>
                </DrawerHeader>
                <div className="overflow-y-auto overflow-x-hidden flex-1 min-h-0 px-4 pb-4 seamless-scroll">
                  {typeOptions.map((opt) => (
                    <FilterItem
                      key={`type-${opt}`}
                      label={
                        opt === "All Types"
                          ? t("expenses.expenseTypeFilter.allTypes", "All Types")
                          : opt === "Other"
                            ? t("incomes.distribution.other", "Other")
                            : opt
                      }
                      active={selectedType === opt}
                      onClick={() => {
                        setSelectedType(opt);
                        setTypeDrawerOpen(false);
                      }}
                    />
                  ))}
                </div>
              </DrawerContent>
            </Drawer>

            <Drawer open={bankDrawerOpen} onOpenChange={setBankDrawerOpen}>
              <DrawerTrigger asChild>
                <Button variant="outline" className="h-9 w-full justify-between text-xs px-2" disabled={bankAccountsLoading}>
                  <span className="truncate">{bankOptions.find((b) => b.value === selectedBankAccount)?.label || t("incomes.distribution.allBankAccounts", "All Bank Accounts")}</span>
                  <ChevronDown className="h-4 w-4 flex-shrink-0" />
                </Button>
              </DrawerTrigger>
              <DrawerContent className="max-h-[85dvh] flex flex-col">
                <DrawerHeader className="text-left pb-2 safe-area-top px-4 pt-4">
                  <DrawerTitle className="text-base font-semibold">{t("incomes.distribution.bankAccount", "Bank Account")}</DrawerTitle>
                  <DrawerDescription className="sr-only">{t("incomes.distribution.selectBankAccountFilter", "Select bank account filter")}</DrawerDescription>
                </DrawerHeader>
                <div className="overflow-y-auto overflow-x-hidden flex-1 min-h-0 px-4 pb-4 seamless-scroll">
                  {bankOptions.map((opt) => (
                    <FilterItem
                      key={opt.value}
                      label={opt.label}
                      active={selectedBankAccount === opt.value}
                      onClick={() => {
                        setSelectedBankAccount(opt.value);
                        setBankDrawerOpen(false);
                      }}
                    />
                  ))}
                </div>
              </DrawerContent>
            </Drawer>
          </div>

          <div className="p-2 min-w-0">
            <div className="flex justify-between items-center mb-3 gap-2 min-w-0">
              <h3 className="text-base font-semibold truncate">{t("incomes.distribution.title", "Income Distribution")}</h3>
              <div className="text-base font-semibold truncate">{formatToRupiah(totalIncome)}</div>
            </div>

            <Tabs value={tab} onValueChange={(v) => setTab(v as "overview" | "service" | "monthly")} className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-4 p-0 h-10 border border-border rounded-md bg-muted overflow-hidden">
                <TabsTrigger value="overview" className="text-xs sm:text-sm h-full py-0 border-r border-border rounded-none data-[state=active]:rounded-none data-[state=active]:shadow-sm last:border-r-0">
                  {t("expenses.breakdownOverview", "Overview")}
                </TabsTrigger>
                <TabsTrigger value="service" className="text-xs sm:text-sm h-full py-0 border-r border-border rounded-none data-[state=active]:rounded-none data-[state=active]:shadow-sm last:border-r-0">
                  {t("incomes.distribution.service", "Service")}
                </TabsTrigger>
                <TabsTrigger value="monthly" className="text-xs sm:text-sm h-full py-0 border-r border-border rounded-none data-[state=active]:rounded-none data-[state=active]:shadow-sm last:border-r-0">
                  {t("expenses.monthlyComparisonTab", "Monthly")}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="mt-0">
                <BarsArea
                  bars={bars}
                  isLoading={isLoading}
                  emptyLabel={t("incomes.distribution.noData", "No income data available")}
                />
              </TabsContent>
              <TabsContent value="service" className="mt-0">
                <BarsArea
                  bars={bars}
                  isLoading={isLoading}
                  emptyLabel={t("incomes.distribution.noData", "No income data available")}
                />
              </TabsContent>
              <TabsContent value="monthly" className="mt-0">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <h4 className="text-sm font-semibold text-gray-800 truncate">
                      {t("incomes.distribution.monthlyTrendTitle", "Monthly Income Trend Year")} {selectedYear}
                    </h4>
                    <p className="text-xs text-gray-600 truncate">{t("incomes.distribution.monthlyTrendSubtitle", "Rupiah unit | Jan - Dec")} {selectedYear}</p>
                  </div>
                  <Drawer open={yearDrawerOpen} onOpenChange={setYearDrawerOpen}>
                    <DrawerTrigger asChild>
                      <Button variant="outline" className="h-8 min-w-[84px] justify-between text-xs px-2">
                        <span>{selectedYear}</span>
                        <ChevronDown className="h-4 w-4 flex-shrink-0" />
                      </Button>
                    </DrawerTrigger>
                    <DrawerContent className="max-h-[85dvh] flex flex-col">
                      <DrawerHeader className="text-left pb-2 safe-area-top px-4 pt-4">
                        <DrawerTitle className="text-base font-semibold">{t("incomes.distribution.year", "Year")}</DrawerTitle>
                        <DrawerDescription className="sr-only">{t("incomes.distribution.selectYear", "Select year")}</DrawerDescription>
                      </DrawerHeader>
                      <div className="overflow-y-auto overflow-x-hidden flex-1 min-h-0 px-4 pb-4 seamless-scroll">
                        {["2026", "2025", "2024", "2023"].map((year) => (
                          <FilterItem
                            key={`year-${year}`}
                            label={year}
                            active={selectedYear === year}
                            onClick={() => {
                              setSelectedYear(year);
                              setYearDrawerOpen(false);
                            }}
                          />
                        ))}
                      </div>
                    </DrawerContent>
                  </Drawer>
                </div>
                <IncomeMonthlyTrendChart monthlyData={monthlyChartData} isEmpty={monthlyLoading || monthlyChartData.length === 0} />
              </TabsContent>
            </Tabs>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function FilterItem({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center justify-between w-full px-3 py-2.5 text-left text-sm border-b border-border last:border-b-0",
        active ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted/50"
      )}
    >
      <span className="truncate">{label}</span>
      {active ? <Check className="h-4 w-4 text-primary flex-shrink-0" /> : null}
    </button>
  );
}

function BarsArea({
  bars,
  isLoading,
  emptyLabel,
}: {
  bars: { name: string; amount: number; heightPercentage: number; colorClass: string }[];
  isLoading: boolean;
  emptyLabel: string;
}) {
  if (isLoading) {
    return <div className="h-40 bg-gray-100 rounded animate-pulse" />;
  }

  if (bars.length === 0) {
    return (
      <div className="h-32 bg-gray-100 rounded flex items-center justify-center">
        <span className="text-gray-500 text-sm">{emptyLabel}</span>
      </div>
    );
  }

  return (
    <div
      className="overflow-x-auto overflow-y-hidden seamless-scroll nested-scroll-touch-chain-xy touch-pan-x -mx-1 px-1"
      style={{ scrollBehavior: "smooth" }}
    >
      <div className="flex items-end flex-nowrap justify-start gap-3 pt-2 pb-0 min-h-0">
        {bars.map((item) => (
          <div
            key={item.name}
            className="flex flex-col items-center flex-shrink-0 min-w-[80px] max-w-[96px] gap-1 pb-0"
          >
            <div className="w-full bg-gray-100 rounded flex flex-col justify-end h-48 p-1 min-h-[12rem]">
              <div
                className={`w-full ${item.colorClass} rounded-t min-h-[4px] transition-[height] duration-300 ease-in-out`}
                style={{ height: `${Math.max(item.heightPercentage, 8)}%` }}
                title={`${item.name}: ${formatToRupiah(item.amount)}`}
              />
            </div>
            <span
              className="text-xs text-gray-600 text-center whitespace-nowrap w-full overflow-hidden text-ellipsis px-0.5"
              title={item.name}
            >
              {item.name}
            </span>
            <span
              className="text-xs font-medium text-gray-800 text-center whitespace-nowrap w-full overflow-hidden text-ellipsis px-0.5"
              title={formatToRupiah(item.amount)}
            >
              {formatToRupiah(item.amount)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
