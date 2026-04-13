import { useMemo, useState } from "react";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { Button } from "@/shared/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/shared/components/ui/drawer";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";
import { Check, ChevronDown } from "lucide-react";
import { formatToRupiah } from "@/shared/utils/formatCurrency";
import { cn } from "@/shared/lib/utils";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import type { IncomeDistributionTabKey } from "@/4-1-dashboard/hooks/useIncomeDashboardModel";
import type { IncomeTransactionWithRelations } from "@/4-1-dashboard/types";
import type { BankAccount } from "@/shared/hooks/finance/useBankAccounts";

type MonthlyRow = { month: string; shortMonth?: string; value: number };

type IncomeTypeLite = { id: string; name: string };

const CHART_MIN_WIDTH = 680;

const PERIOD_OPTIONS = [
  "This Month",
  "Last Month",
  "Last 3 Months",
  "Last 6 Months",
  "This Year",
  "Last Year",
] as const;

type Props = {
  filteredTransactions: IncomeTransactionWithRelations[];
  monthlyData: MonthlyRow[];
  monthlyLoading?: boolean;
  incomeDistributionTab: IncomeDistributionTabKey;
  onTabChange: (v: IncomeDistributionTabKey) => void;
  selectedYear: string;
  onYearChange: (v: string) => void;
  selectedPeriod: string;
  onPeriodChange: (v: string) => void;
  selectedType: string;
  onTypeChange: (v: string) => void;
  selectedBankAccount: string;
  onBankChange: (v: string) => void;
  incomeTypes: IncomeTypeLite[];
  bankAccounts: BankAccount[];
  hasTransactionsWithoutType: boolean;
  bankAccountsLoading?: boolean;
};

export function MobileIncomeDistributionCard({
  filteredTransactions,
  monthlyData,
  monthlyLoading = false,
  incomeDistributionTab,
  onTabChange,
  selectedYear,
  onYearChange,
  selectedPeriod,
  onPeriodChange,
  selectedType,
  onTypeChange,
  selectedBankAccount,
  onBankChange,
  incomeTypes,
  bankAccounts,
  hasTransactionsWithoutType,
  bankAccountsLoading = false,
}: Props) {
  const { t } = useAppTranslation();
  const [periodDrawerOpen, setPeriodDrawerOpen] = useState(false);
  const [typeDrawerOpen, setTypeDrawerOpen] = useState(false);
  const [bankDrawerOpen, setBankDrawerOpen] = useState(false);
  const [yearDrawerOpen, setYearDrawerOpen] = useState(false);

  const distributionTotal = filteredTransactions.reduce(
    (sum, t) => sum + parseFloat(String(t.amount ?? 0)),
    0,
  );

  const yearNum = new Date().getFullYear();
  const yearOptions = Array.from({ length: 5 }, (_, i) => String(yearNum - i));

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
    return ["All Types", ...names] as string[];
  }, [incomeTypes, hasTransactionsWithoutType]);

  const selectedTypeLabel =
    selectedType === "All Types"
      ? t("expenses.expenseTypeFilter.allTypes", "All Types")
      : selectedType === "Other"
        ? t("incomes.distribution.other", "Other")
        : selectedType;

  const bankOptions = useMemo(
    () => [
      { value: "all", label: t("incomes.distribution.allBankAccounts", "All Bank Accounts") },
      ...bankAccounts.map((bank) => ({
        value: bank.id,
        label: bank.account_number ? `${bank.name} - ${bank.account_number}` : bank.name,
      })),
    ],
    [bankAccounts, t],
  );

  const monthlyChartData = useMemo(
    () =>
      monthlyData.map((item) => ({
        month: item.shortMonth ?? String(item.month).split(" ")[0],
        amount: item.value,
      })),
    [monthlyData],
  );

  const monthlyChartEmpty =
    monthlyLoading ||
    monthlyChartData.length === 0 ||
    !monthlyChartData.some((d) => d.amount > 0);

  const barColors = [
    "bg-green-500",
    "bg-green-400",
    "bg-brand-blue",
    "bg-brand-blue/70",
    "bg-brand-blue/90",
    "bg-brand-blue/60",
    "bg-brand-blue/50",
    "bg-brand-blue/30",
  ];

  const bars = useMemo(() => {
    const source =
      incomeDistributionTab === "overview"
        ? filteredTransactions.reduce((acc, trx) => {
            const key = trx.income_types?.name || t("incomes.distribution.uncategorized", "Uncategorized");
            const amount = parseFloat(String(trx.amount ?? 0));
            acc[key] = (acc[key] || 0) + amount;
            return acc;
          }, {} as Record<string, number>)
        : filteredTransactions.reduce((acc, trx) => {
            const key = trx.services?.name || t("incomes.distribution.uncategorized", "Uncategorized");
            const amount = parseFloat(String(trx.amount ?? 0));
            acc[key] = (acc[key] || 0) + amount;
            return acc;
          }, {} as Record<string, number>);

    const entries = Object.entries(source);
    const maxAmount = entries.length > 0 ? Math.max(...entries.map(([, v]) => v)) : 0;

    return entries.map(([name, amount], index) => ({
      name,
      amount,
      heightPercentage: maxAmount > 0 ? (amount / maxAmount) * 80 : 0,
      colorClass: barColors[index % barColors.length],
    }));
  }, [filteredTransactions, incomeDistributionTab, t]);

  const drawerOverlay = "z-[100]";
  const drawerContentClass = "z-[100] max-h-[85dvh] flex flex-col";

  return (
    <Card className="min-w-0 overflow-hidden border border-border bg-card">
      <CardContent className="flex min-w-0 flex-col p-0">
        <div className="grid min-w-0 grid-cols-3 gap-2 border-b border-border bg-muted/50 px-2 py-2">
          <Drawer open={periodDrawerOpen} onOpenChange={setPeriodDrawerOpen}>
            <DrawerTrigger asChild>
              <Button variant="outline" className="h-9 w-full justify-between px-2 text-xs">
                <span className="truncate">{selectedPeriodLabel}</span>
                <ChevronDown className="h-4 w-4 flex-shrink-0" />
              </Button>
            </DrawerTrigger>
            <DrawerContent overlayClassName={drawerOverlay} className={drawerContentClass}>
              <DrawerHeader className="safe-area-top px-4 pb-2 pt-4 text-left">
                <DrawerTitle className="text-base font-semibold">
                  {t("incomes.distribution.period", "Period")}
                </DrawerTitle>
                <DrawerDescription className="sr-only">
                  {t("incomes.distribution.selectPeriodFilter", "Select period filter")}
                </DrawerDescription>
              </DrawerHeader>
              <div className="seamless-scroll min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-4 pb-4">
                {PERIOD_OPTIONS.map((opt) => (
                  <FilterItem
                    key={opt}
                    label={periodLabelMap[opt] ?? opt}
                    active={selectedPeriod === opt}
                    onClick={() => {
                      onPeriodChange(opt);
                      setPeriodDrawerOpen(false);
                    }}
                  />
                ))}
              </div>
            </DrawerContent>
          </Drawer>

          <Drawer open={typeDrawerOpen} onOpenChange={setTypeDrawerOpen}>
            <DrawerTrigger asChild>
              <Button variant="outline" className="h-9 w-full justify-between px-2 text-xs">
                <span className="truncate">{selectedTypeLabel}</span>
                <ChevronDown className="h-4 w-4 flex-shrink-0" />
              </Button>
            </DrawerTrigger>
            <DrawerContent overlayClassName={drawerOverlay} className={drawerContentClass}>
              <DrawerHeader className="safe-area-top px-4 pb-2 pt-4 text-left">
                <DrawerTitle className="text-base font-semibold">
                  {t("incomes.distribution.type", "Type")}
                </DrawerTitle>
                <DrawerDescription className="sr-only">
                  {t("incomes.distribution.selectIncomeTypeFilter", "Select income type filter")}
                </DrawerDescription>
              </DrawerHeader>
              <div className="seamless-scroll min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-4 pb-4">
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
                      onTypeChange(opt);
                      setTypeDrawerOpen(false);
                    }}
                  />
                ))}
              </div>
            </DrawerContent>
          </Drawer>

          <Drawer open={bankDrawerOpen} onOpenChange={setBankDrawerOpen}>
            <DrawerTrigger asChild>
              <Button
                variant="outline"
                className="h-9 w-full justify-between px-2 text-xs"
                disabled={bankAccountsLoading}
              >
                <span className="truncate">
                  {bankOptions.find((b) => b.value === selectedBankAccount)?.label ??
                    t("incomes.distribution.allBankAccounts", "All Bank Accounts")}
                </span>
                <ChevronDown className="h-4 w-4 flex-shrink-0" />
              </Button>
            </DrawerTrigger>
            <DrawerContent overlayClassName={drawerOverlay} className={drawerContentClass}>
              <DrawerHeader className="safe-area-top px-4 pb-2 pt-4 text-left">
                <DrawerTitle className="text-base font-semibold">
                  {t("incomes.distribution.bankAccount", "Bank Account")}
                </DrawerTitle>
                <DrawerDescription className="sr-only">
                  {t("incomes.distribution.selectBankAccountFilter", "Select bank account filter")}
                </DrawerDescription>
              </DrawerHeader>
              <div className="seamless-scroll min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-4 pb-4">
                {bankOptions.map((opt) => (
                  <FilterItem
                    key={opt.value}
                    label={opt.label}
                    active={selectedBankAccount === opt.value}
                    onClick={() => {
                      onBankChange(opt.value);
                      setBankDrawerOpen(false);
                    }}
                  />
                ))}
              </div>
            </DrawerContent>
          </Drawer>
        </div>

        <div className="min-w-0 p-2">
          <div className="mb-3 flex min-w-0 items-center justify-between gap-2">
            <h3 className="truncate text-base font-semibold text-foreground">
              {t("incomes.distribution.title", "Income Distribution")}
            </h3>
            <div className="shrink-0 truncate text-right text-base font-semibold text-foreground">
              {formatToRupiah(distributionTotal)}
            </div>
          </div>

          <Tabs
            value={incomeDistributionTab}
            onValueChange={(v) => onTabChange(v as IncomeDistributionTabKey)}
            className="w-full min-w-0"
          >
            <TabsList className="mb-4 grid h-10 w-full grid-cols-3 overflow-hidden rounded-md border border-border bg-muted p-0 text-muted-foreground">
              <TabsTrigger
                value="overview"
                className="h-full rounded-none border-r border-border py-0 text-xs transition-colors hover:bg-brand-blue/10 hover:text-brand-blue data-[state=active]:rounded-none data-[state=active]:bg-brand-blue data-[state=active]:font-semibold data-[state=active]:text-white data-[state=active]:shadow-sm data-[state=active]:hover:bg-brand-blue/90 data-[state=active]:hover:text-white sm:text-sm"
              >
                {t("expenses.breakdownOverview", "Overview")}
              </TabsTrigger>
              <TabsTrigger
                value="service"
                className="h-full rounded-none border-r border-border py-0 text-xs transition-colors hover:bg-brand-blue/10 hover:text-brand-blue data-[state=active]:rounded-none data-[state=active]:bg-brand-blue data-[state=active]:font-semibold data-[state=active]:text-white data-[state=active]:shadow-sm data-[state=active]:hover:bg-brand-blue/90 data-[state=active]:hover:text-white sm:text-sm"
              >
                {t("incomes.distribution.service", "Service")}
              </TabsTrigger>
              <TabsTrigger
                value="monthly"
                className="h-full rounded-none py-0 text-xs transition-colors hover:bg-brand-blue/10 hover:text-brand-blue data-[state=active]:rounded-none data-[state=active]:bg-brand-blue data-[state=active]:font-semibold data-[state=active]:text-white data-[state=active]:shadow-sm data-[state=active]:hover:bg-brand-blue/90 data-[state=active]:hover:text-white sm:text-sm"
              >
                {t("expenses.monthlyComparisonTab", "Monthly")}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-0 min-w-0">
              <BarsArea
                bars={bars}
                emptyLabel={t("incomes.distribution.noData", "No income data available")}
              />
            </TabsContent>

            <TabsContent value="service" className="mt-0 min-w-0">
              <BarsArea
                bars={bars}
                emptyLabel={t("incomes.distribution.noData", "No income data available")}
              />
            </TabsContent>

            <TabsContent value="monthly" className="mt-0 min-w-0">
              <div className="mb-2 flex min-w-0 items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {t("incomes.distribution.monthlyTrendTitle", "Monthly Income Trend Year")} {selectedYear}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {t("incomes.distribution.monthlyTrendSubtitle", "Rupiah unit | Jan - Dec")} {selectedYear}
                  </p>
                </div>
                <Drawer open={yearDrawerOpen} onOpenChange={setYearDrawerOpen}>
                  <DrawerTrigger asChild>
                    <Button variant="outline" className="h-8 min-w-[84px] justify-between px-2 text-xs">
                      <span>{selectedYear}</span>
                      <ChevronDown className="h-4 w-4 flex-shrink-0" />
                    </Button>
                  </DrawerTrigger>
                  <DrawerContent overlayClassName={drawerOverlay} className={drawerContentClass}>
                    <DrawerHeader className="safe-area-top px-4 pb-2 pt-4 text-left">
                      <DrawerTitle className="text-base font-semibold">
                        {t("incomes.distribution.year", "Year")}
                      </DrawerTitle>
                      <DrawerDescription className="sr-only">
                        {t("incomes.distribution.selectYear", "Select year")}
                      </DrawerDescription>
                    </DrawerHeader>
                    <div className="seamless-scroll min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-4 pb-4">
                      {yearOptions.map((y) => (
                        <FilterItem
                          key={y}
                          label={y}
                          active={selectedYear === y}
                          onClick={() => {
                            onYearChange(y);
                            setYearDrawerOpen(false);
                          }}
                        />
                      ))}
                    </div>
                  </DrawerContent>
                </Drawer>
              </div>

              <MonthlyTrendChartArea
                monthlyChartData={monthlyChartData}
                isEmpty={monthlyChartEmpty}
                emptyLabel={t(
                  "incomes.distribution.noYearData",
                  "No income data available for this year",
                )}
              />
            </TabsContent>
          </Tabs>
        </div>
      </CardContent>
    </Card>
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
        "flex w-full items-center justify-between border-b border-border px-3 py-2.5 text-left text-sm last:border-b-0",
        active ? "bg-primary/10 font-medium text-primary" : "hover:bg-muted/50",
      )}
    >
      <span className="truncate">{label}</span>
      {active ? <Check className="h-4 w-4 flex-shrink-0 text-primary" /> : null}
    </button>
  );
}

function BarsArea({
  bars,
  emptyLabel,
}: {
  bars: { name: string; amount: number; heightPercentage: number; colorClass: string }[];
  emptyLabel: string;
}) {
  if (bars.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center rounded-lg bg-muted/40">
        <span className="text-sm text-muted-foreground">{emptyLabel}</span>
      </div>
    );
  }

  return (
    <div
      className="scrollbar-hide seamless-scroll -mx-1 overflow-x-auto overflow-y-hidden px-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      style={{ scrollBehavior: "smooth" }}
    >
      <div className="flex min-h-0 flex-nowrap items-end justify-start gap-3 pb-0 pt-2">
        {bars.map((item) => (
          <div
            key={item.name}
            className="flex min-h-[12rem] min-w-[80px] max-w-[96px] flex-shrink-0 flex-col items-center gap-1 pb-0"
          >
            <div className="flex h-48 w-full flex-col justify-end rounded bg-muted/50 p-1">
              <div
                className={cn(
                  "min-h-[4px] w-full rounded-t transition-[height] duration-300 ease-in-out",
                  item.colorClass,
                )}
                style={{
                  height: `${Math.max(item.heightPercentage, 8)}%`,
                }}
                title={`${item.name}: ${formatToRupiah(item.amount)}`}
              />
            </div>
            <span
              className="w-full overflow-hidden text-ellipsis whitespace-nowrap px-0.5 text-center text-xs text-muted-foreground"
              title={item.name}
            >
              {item.name}
            </span>
            <span
              className="w-full overflow-hidden text-ellipsis whitespace-nowrap px-0.5 text-center text-xs font-medium text-foreground"
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

function MonthlyTrendChartArea({
  monthlyChartData,
  isEmpty,
  emptyLabel,
}: {
  monthlyChartData: { month: string; amount: number }[];
  isEmpty: boolean;
  emptyLabel: string;
}) {
  const nbsp = "\u00A0";
  const formatY = (value: number) => {
    if (value >= 1_000_000) return `Rp${nbsp}${Math.round(value / 1_000_000)}jt`;
    if (value >= 1_000) return `Rp${nbsp}${Math.round(value / 1_000)}rb`;
    return `Rp${nbsp}${value.toLocaleString("id-ID")}`;
  };

  if (isEmpty) {
    return (
      <div className="flex h-[200px] items-center justify-center rounded-lg bg-muted/40 px-3 sm:h-[220px]">
        <span className="text-center text-sm text-muted-foreground">{emptyLabel}</span>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div
        className="scrollbar-hide seamless-scroll overflow-x-auto overflow-y-hidden"
        style={{ scrollBehavior: "smooth", WebkitOverflowScrolling: "touch" }}
      >
        <div
          style={{ width: CHART_MIN_WIDTH, minWidth: CHART_MIN_WIDTH }}
          className="h-[220px] flex-shrink-0 pr-1 sm:h-[240px]"
        >
          <ResponsiveContainer width={CHART_MIN_WIDTH} height="100%">
            <LineChart data={monthlyChartData} margin={{ top: 2, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="month"
                fontSize={10}
                stroke="#6b7280"
                tickLine={false}
                tick={{ fill: "#6b7280" }}
                interval={0}
              />
              <YAxis
                fontSize={10}
                stroke="#6b7280"
                tickLine={false}
                width={48}
                tick={{ fill: "#6b7280", style: { whiteSpace: "nowrap" } }}
                tickFormatter={formatY}
              />
              <Tooltip
                formatter={(value: number) => [`Rp ${Number(value).toLocaleString("id-ID")}`, "Income"]}
                contentStyle={{
                  backgroundColor: "white",
                  border: "1px solid #e5e7eb",
                  borderRadius: "6px",
                  fontSize: "12px",
                }}
              />
              <Line
                type="monotone"
                dataKey="amount"
                stroke="hsl(var(--brand-blue))"
                strokeWidth={2}
                dot={{ fill: "hsl(var(--brand-blue))", strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="mt-0.5 flex flex-shrink-0 items-center">
        <div className="mr-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-brand-blue" />
        <span className="text-xs text-muted-foreground">Income</span>
      </div>
    </div>
  );
}
