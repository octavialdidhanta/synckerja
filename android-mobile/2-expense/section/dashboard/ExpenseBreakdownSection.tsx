import { useState } from "react";
import { Card, CardContent } from "@/mobile-app/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/mobile-app/components/ui/tabs";
import { useExpenseBreakdown } from "@/mobile/2-expense/hooks/useExpenseBreakdown";
import { useMonthlyExpenseData } from "@/shared/hooks/finance/useMonthlyExpenseData";
import { MonthlyComparisonChart } from "@/mobile/2-expense/section/dashboard/MonthlyComparisonChart";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";

function formatCurrency(amount: number) {
  return `Rp ${amount.toLocaleString("id-ID")}`;
}

export interface ExpenseBreakdownDataItem {
  amount: number;
  expense_type?: string;
  category?: string;
  create_date?: string;
}

export interface ExpenseBreakdownSectionProps {
  allExpenses?: ExpenseBreakdownDataItem[];
  allExpensesForCategoryBreakdown?: ExpenseBreakdownDataItem[];
  totalExpenses?: number;
  periodLabel?: string;
}

const BAR_COLORS = [
  "bg-primary",
  "bg-brand-blue-deep",
  "bg-brand-blue",
  "bg-info",
  "bg-primary/80",
  "bg-brand-blue-deep/80",
  "bg-info-muted",
  "bg-brand-blue-soft",
];

/** Segmented tabs: inactive hover = brand tint; active = solid primary + foreground */
const breakdownTabsTriggerClass =
  "h-full rounded-none border-r border-border py-0 text-xs transition-colors sm:text-sm " +
  "text-muted-foreground hover:bg-primary/12 hover:text-primary " +
  "data-[state=active]:rounded-none data-[state=active]:border-primary " +
  "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm " +
  "data-[state=active]:hover:bg-primary/90 data-[state=active]:hover:text-primary-foreground";

export function ExpenseBreakdownSection(props: ExpenseBreakdownSectionProps = {}) {
  const { t } = useAppTranslation();
  const [breakdownTab, setBreakdownTab] = useState<"overview" | "category" | "monthly">("overview");
  const hookData = useExpenseBreakdown();
  const allExpenses = props.allExpenses ?? hookData.allExpenses;
  const allExpensesForCategoryBreakdown =
    props.allExpensesForCategoryBreakdown ?? hookData.allExpensesForCategoryBreakdown;
  const totalExpenses = props.totalExpenses ?? hookData.totalExpenses;
  const isFilteredData = props.allExpenses != null;
  const totalLabel =
    isFilteredData && props.periodLabel ? props.periodLabel : t("expenses.breakdownYtdLabel", "YTD");
  const monthlyData = useMonthlyExpenseData(allExpenses);

  /** Hook-only usage (no parent data): avoid a second skeleton; page-level shell handles initial load. */
  if (props.allExpenses === undefined && hookData.isLoading) {
    return null;
  }

  return (
    <Card className="w-full min-w-0 border border-border bg-card">
      <CardContent className="flex min-w-0 flex-col px-3 pb-2 pt-3">
        <div className="mb-4 flex min-w-0 items-center justify-between gap-2">
          <h3 className="truncate text-base font-semibold sm:text-lg">
            {t("expenses.breakdownTitle", "Expense Breakdown")}
          </h3>
          <div className="min-w-0 flex-shrink-0 text-right">
            <div className="text-xs text-muted-foreground">{totalLabel}</div>
            <div className="truncate text-base font-semibold sm:text-lg">{formatCurrency(totalExpenses)}</div>
          </div>
        </div>

        <Tabs
          value={breakdownTab}
          onValueChange={(v) => setBreakdownTab(v as "overview" | "category" | "monthly")}
          className="w-full"
        >
          <TabsList className="mb-4 grid h-10 w-full grid-cols-3 overflow-hidden rounded-md border border-border bg-muted p-0">
            <TabsTrigger value="overview" className={breakdownTabsTriggerClass}>
              {t("expenses.breakdownOverview", "Overview")}
            </TabsTrigger>
            <TabsTrigger value="category" className={breakdownTabsTriggerClass}>
              {t("expenses.breakdownCategory", "Expense Category")}
            </TabsTrigger>
            <TabsTrigger value="monthly" className={cn(breakdownTabsTriggerClass, "border-r-0")}>
              {t("expenses.monthlyComparisonTab", "Monthly")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-0">
            {allExpenses.length > 0 ? (
              <div
                className="-mx-1 overflow-x-auto overflow-y-hidden px-1 seamless-scroll"
                style={{ scrollBehavior: "smooth" }}
              >
                <div className="flex min-h-0 flex-nowrap items-end justify-start gap-3 pb-0 pt-2">
                  {(() => {
                    const expenseTypeTotals = allExpenses.reduce(
                      (acc, expense) => {
                        const type = expense.expense_type || "Uncategorized";
                        acc[type] = (acc[type] || 0) + expense.amount;
                        return acc;
                      },
                      {} as Record<string, number>,
                    );
                    const maxAmount = Math.max(...Object.values(expenseTypeTotals), 0);
                    return Object.entries(expenseTypeTotals).map(([expenseType, amount], index) => {
                      const heightPercentage = maxAmount > 0 ? (amount / maxAmount) * 80 : 0;
                      const colorClass = BAR_COLORS[index % BAR_COLORS.length];
                      return (
                        <div
                          key={expenseType}
                          className="flex min-w-[80px] max-w-[96px] flex-shrink-0 flex-col items-center gap-1 pb-0"
                        >
                          <div className="flex h-48 min-h-[12rem] w-full flex-col justify-end rounded bg-gray-100 p-1">
                            <div
                              className={`w-full ${colorClass} min-h-[4px] rounded-t transition-[height] duration-300 ease-in-out`}
                              style={{
                                height: `${Math.max(heightPercentage, 8)}%`,
                              }}
                              title={`${expenseType}: ${formatCurrency(amount)}`}
                            />
                          </div>
                          <span
                            className="w-full overflow-hidden text-ellipsis whitespace-nowrap px-0.5 text-center text-xs text-gray-600"
                            title={expenseType}
                          >
                            {expenseType}
                          </span>
                          <span
                            className="w-full overflow-hidden text-ellipsis whitespace-nowrap px-0.5 text-center text-xs font-medium text-gray-800"
                            title={formatCurrency(amount)}
                          >
                            {formatCurrency(amount)}
                          </span>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            ) : (
              <div className="mt-4 flex h-32 items-center justify-center rounded bg-gray-100">
                <span className="text-sm text-gray-500">{t("expenses.noExpenseData", "No expense data available")}</span>
              </div>
            )}
          </TabsContent>

          <TabsContent value="category" className="mt-0">
            {allExpensesForCategoryBreakdown.length > 0 ? (
              <div
                className="-mx-1 overflow-x-auto overflow-y-hidden px-1 seamless-scroll"
                style={{ scrollBehavior: "smooth" }}
              >
                <div className="flex min-h-0 flex-nowrap items-end justify-start gap-3 pb-0 pt-2">
                  {(() => {
                    const categoryTotals = allExpensesForCategoryBreakdown.reduce(
                      (acc, expense) => {
                        const cat = expense.category || "Uncategorized";
                        acc[cat] = (acc[cat] || 0) + expense.amount;
                        return acc;
                      },
                      {} as Record<string, number>,
                    );
                    const maxAmount = Math.max(...Object.values(categoryTotals), 0);
                    return Object.entries(categoryTotals).map(([category, amount], index) => {
                      const heightPercentage = maxAmount > 0 ? (amount / maxAmount) * 80 : 0;
                      const colorClass = BAR_COLORS[index % BAR_COLORS.length];
                      return (
                        <div
                          key={category}
                          className="flex min-w-[80px] max-w-[96px] flex-shrink-0 flex-col items-center gap-1 pb-0"
                        >
                          <div className="flex h-48 min-h-[12rem] w-full flex-col justify-end rounded bg-gray-100 p-1">
                            <div
                              className={`w-full ${colorClass} min-h-[4px] rounded-t transition-[height] duration-300 ease-in-out`}
                              style={{
                                height: `${Math.max(heightPercentage, 8)}%`,
                              }}
                              title={`${category}: ${formatCurrency(amount)}`}
                            />
                          </div>
                          <span
                            className="w-full overflow-hidden text-ellipsis whitespace-nowrap px-0.5 text-center text-xs text-gray-600"
                            title={category}
                          >
                            {category}
                          </span>
                          <span
                            className="w-full overflow-hidden text-ellipsis whitespace-nowrap px-0.5 text-center text-xs font-medium text-gray-800"
                            title={formatCurrency(amount)}
                          >
                            {formatCurrency(amount)}
                          </span>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            ) : (
              <div className="mt-4 flex h-32 items-center justify-center rounded bg-gray-100">
                <span className="text-sm text-gray-500">{t("expenses.noExpenseData", "No expense data available")}</span>
              </div>
            )}
          </TabsContent>

          <TabsContent value="monthly" className="mt-0 pt-0">
            <p className="mb-1 text-xs text-muted-foreground sm:text-sm">
              {t("expenses.monthlyComparisonSubtitle", "Expense trends throughout the year")}
            </p>
            <div className="min-h-0 min-w-0">
              <MonthlyComparisonChart monthlyData={monthlyData} isEmpty={monthlyData.length === 0} />
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
