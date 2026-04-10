import { useState } from "react";
import { Card, CardContent } from "@/mobile/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/mobile/components/ui/tabs";
import { Skeleton } from "@/mobile/components/ui/skeleton";
import { useExpenseBreakdown } from "@/mobile/pages/expenses/hooks/useExpenseBreakdown";
import { useMonthlyExpenseData } from "@/mobile/pages/expenses/hooks/useMonthlyExpenseData";
import { MonthlyComparisonChart } from "@/mobile/pages/expenses/section/MonthlyComparisonChart";
import { useAppTranslation } from "@/features/share/i18n/useAppTranslation";

function formatCurrency(amount: number) {
  return `Rp ${amount.toLocaleString("id-ID")}`;
}

/** Minimal shape for breakdown charts (Overview, Category, Monthly). */
export interface ExpenseBreakdownDataItem {
  amount: number;
  expense_type?: string;
  category?: string;
  /** Required for Monthly Comparison tab (group by month in current year). */
  create_date?: string;
}

export interface ExpenseBreakdownSectionProps {
  /** When provided, section uses filtered data (same as desktop). Otherwise uses useExpenseBreakdown (YTD only). */
  allExpenses?: ExpenseBreakdownDataItem[];
  allExpensesForCategoryBreakdown?: ExpenseBreakdownDataItem[];
  totalExpenses?: number;
  isLoadingBreakdown?: boolean;
  /** Label for the total (e.g. "This Month", "This Week"). When filtered data is passed, show this instead of "YTD". */
  periodLabel?: string;
}

const BAR_COLORS = [
  "bg-green-500",
  "bg-green-400",
  "bg-blue-500",
  "bg-blue-400",
  "bg-purple-500",
  "bg-purple-400",
  "bg-orange-500",
  "bg-orange-400",
];

export function ExpenseBreakdownSection(props: ExpenseBreakdownSectionProps = {}) {
  const { t } = useAppTranslation();
  const [breakdownTab, setBreakdownTab] = useState<"overview" | "category" | "monthly">("overview");
  const hookData = useExpenseBreakdown();
  const allExpenses = props.allExpenses ?? hookData.allExpenses;
  const allExpensesForCategoryBreakdown = props.allExpensesForCategoryBreakdown ?? hookData.allExpensesForCategoryBreakdown;
  const totalExpenses = props.totalExpenses ?? hookData.totalExpenses;
  const isLoading = props.isLoadingBreakdown ?? hookData.isLoading;
  const isFilteredData = props.allExpenses != null;
  const totalLabel = isFilteredData && props.periodLabel ? props.periodLabel : t("expenses.breakdownYtdLabel", "YTD");
  const monthlyData = useMonthlyExpenseData(allExpenses);

  if (isLoading) {
    return (
      <Card className="w-full min-w-0 border border-border bg-card">
        <CardContent className="pt-3 px-3 pb-2 flex flex-col min-w-0">
          <div className="flex justify-between items-center mb-4 gap-2 min-w-0">
            <Skeleton className="h-5 w-32" />
            <div className="flex flex-col items-end gap-1">
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-6 w-24" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-1 mb-4">
            <Skeleton className="h-9 rounded-md" />
            <Skeleton className="h-9 rounded-md" />
            <Skeleton className="h-9 rounded-md" />
          </div>
          <div className="flex items-end flex-nowrap justify-start gap-3 pt-2 pb-0 h-48">
            {[96, 72, 48, 84, 60].map((heightPx, i) => (
              <div key={i} className="flex flex-col items-center flex-shrink-0 min-w-[80px] max-w-[96px] gap-1">
                <Skeleton className="w-full rounded-t flex-shrink-0" style={{ height: heightPx }} />
                <Skeleton className="h-3 w-full max-w-[70px]" />
                <Skeleton className="h-3 w-full max-w-[50px]" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full min-w-0 border border-border bg-card">
      <CardContent className="pt-3 px-3 pb-2 flex flex-col min-w-0">
        <div className="flex justify-between items-center mb-4 gap-2 min-w-0">
          <h3 className="text-base sm:text-lg font-semibold truncate">
            {t("expenses.breakdownTitle", "Expense Breakdown")}
          </h3>
          <div className="text-right min-w-0 flex-shrink-0">
            <div className="text-xs text-muted-foreground">
              {totalLabel}
            </div>
            <div className="text-base sm:text-lg font-semibold truncate">
              {formatCurrency(totalExpenses)}
            </div>
          </div>
        </div>

        <Tabs
          value={breakdownTab}
          onValueChange={(v) => setBreakdownTab(v as "overview" | "category" | "monthly")}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-3 mb-4 p-0 h-10 border border-border rounded-md bg-muted overflow-hidden">
            <TabsTrigger value="overview" className="text-xs sm:text-sm h-full py-0 border-r border-border rounded-none data-[state=active]:rounded-none data-[state=active]:shadow-sm last:border-r-0">
              {t("expenses.breakdownOverview", "Overview")}
            </TabsTrigger>
            <TabsTrigger value="category" className="text-xs sm:text-sm h-full py-0 border-r border-border rounded-none data-[state=active]:rounded-none data-[state=active]:shadow-sm last:border-r-0">
              {t("expenses.breakdownCategory", "Expense Category")}
            </TabsTrigger>
            <TabsTrigger value="monthly" className="text-xs sm:text-sm h-full py-0 border-r border-border rounded-none data-[state=active]:rounded-none data-[state=active]:shadow-sm last:border-r-0">
              {t("expenses.monthlyComparisonTab", "Monthly")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-0">
            {allExpenses.length > 0 ? (
              <div
                className="overflow-x-auto overflow-y-hidden seamless-scroll -mx-1 px-1"
                style={{ scrollBehavior: "smooth" }}
              >
                <div className="flex items-end flex-nowrap justify-start gap-3 pt-2 pb-0 min-h-0">
                  {(() => {
                    const expenseTypeTotals = allExpenses.reduce(
                      (acc, expense) => {
                        const type = expense.expense_type || "Uncategorized";
                        acc[type] = (acc[type] || 0) + expense.amount;
                        return acc;
                      },
                      {} as Record<string, number>
                    );
                    const maxAmount = Math.max(...Object.values(expenseTypeTotals), 0);
                    return Object.entries(expenseTypeTotals).map(
                      ([expenseType, amount], index) => {
                        const heightPercentage =
                          maxAmount > 0 ? (amount / maxAmount) * 80 : 0;
                        const colorClass = BAR_COLORS[index % BAR_COLORS.length];
                        return (
                          <div
                            key={expenseType}
                            className="flex flex-col items-center flex-shrink-0 min-w-[80px] max-w-[96px] gap-1 pb-0"
                          >
                            <div className="w-full bg-gray-100 rounded flex flex-col justify-end h-48 p-1 min-h-[12rem]">
                              <div
                                className={`w-full ${colorClass} rounded-t min-h-[4px] transition-[height] duration-300 ease-in-out`}
                                style={{
                                  height: `${Math.max(heightPercentage, 8)}%`,
                                }}
                                title={`${expenseType}: ${formatCurrency(amount)}`}
                              />
                            </div>
                            <span
                              className="text-xs text-gray-600 text-center whitespace-nowrap w-full overflow-hidden text-ellipsis px-0.5"
                              title={expenseType}
                            >
                              {expenseType}
                            </span>
                            <span
                              className="text-xs font-medium text-gray-800 text-center whitespace-nowrap w-full overflow-hidden text-ellipsis px-0.5"
                              title={formatCurrency(amount)}
                            >
                              {formatCurrency(amount)}
                            </span>
                          </div>
                        );
                      }
                    );
                  })()}
                </div>
              </div>
            ) : (
              <div className="mt-4 h-32 bg-gray-100 rounded flex items-center justify-center">
                <span className="text-gray-500 text-sm">
                  {t("expenses.noExpenseData", "No expense data available")}
                </span>
              </div>
            )}
          </TabsContent>

          <TabsContent value="category" className="mt-0">
            {allExpensesForCategoryBreakdown.length > 0 ? (
              <div
                className="overflow-x-auto overflow-y-hidden seamless-scroll -mx-1 px-1"
                style={{ scrollBehavior: "smooth" }}
              >
                <div className="flex items-end flex-nowrap justify-start gap-3 pt-2 pb-0 min-h-0">
                  {(() => {
                    const categoryTotals =
                      allExpensesForCategoryBreakdown.reduce(
                        (acc, expense) => {
                          const cat = expense.category || "Uncategorized";
                          acc[cat] = (acc[cat] || 0) + expense.amount;
                          return acc;
                        },
                        {} as Record<string, number>
                      );
                    const maxAmount = Math.max(
                      ...Object.values(categoryTotals),
                      0
                    );
                    return Object.entries(categoryTotals).map(
                      ([category, amount], index) => {
                        const heightPercentage =
                          maxAmount > 0 ? (amount / maxAmount) * 80 : 0;
                        const colorClass = BAR_COLORS[index % BAR_COLORS.length];
                        return (
                          <div
                            key={category}
                            className="flex flex-col items-center flex-shrink-0 min-w-[80px] max-w-[96px] gap-1 pb-0"
                          >
                            <div className="w-full bg-gray-100 rounded flex flex-col justify-end h-48 p-1 min-h-[12rem]">
                              <div
                                className={`w-full ${colorClass} rounded-t min-h-[4px] transition-[height] duration-300 ease-in-out`}
                                style={{
                                  height: `${Math.max(heightPercentage, 8)}%`,
                                }}
                                title={`${category}: ${formatCurrency(amount)}`}
                              />
                            </div>
                            <span
                              className="text-xs text-gray-600 text-center whitespace-nowrap w-full overflow-hidden text-ellipsis px-0.5"
                              title={category}
                            >
                              {category}
                            </span>
                            <span
                              className="text-xs font-medium text-gray-800 text-center whitespace-nowrap w-full overflow-hidden text-ellipsis px-0.5"
                              title={formatCurrency(amount)}
                            >
                              {formatCurrency(amount)}
                            </span>
                          </div>
                        );
                      }
                    );
                  })()}
                </div>
              </div>
            ) : (
              <div className="mt-4 h-32 bg-gray-100 rounded flex items-center justify-center">
                <span className="text-gray-500 text-sm">
                  {t("expenses.noExpenseData", "No expense data available")}
                </span>
              </div>
            )}
          </TabsContent>

          <TabsContent value="monthly" className="mt-0 pt-0">
            <p className="text-xs sm:text-sm text-muted-foreground mb-1">
              {t("expenses.monthlyComparisonSubtitle", "Expense trends throughout the year")}
            </p>
            <div className="min-h-0 min-w-0">
              <MonthlyComparisonChart
                monthlyData={monthlyData}
                isEmpty={monthlyData.length === 0}
              />
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
