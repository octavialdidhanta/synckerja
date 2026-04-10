import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useAppTranslation } from "@/features/share/i18n/useAppTranslation";
import type { MonthlyDataItem } from "@/mobile/pages/expenses/hooks/useMonthlyExpenseData";

export interface MonthlyComparisonChartProps {
  monthlyData: MonthlyDataItem[];
  /** When true, show empty state. */
  isEmpty?: boolean;
}

/** Min width so 12 months have ~44px each; readable with horizontal scroll. */
const CHART_MIN_WIDTH = 528;

/**
 * Monthly Comparison line chart. Same logic and styling as desktop ExpenseDashboard.
 * Y-axis: Rp Xrb / Rp Xjt. Wrapped in seamless horizontal scroll for mobile readability.
 */
export function MonthlyComparisonChart({ monthlyData, isEmpty }: MonthlyComparisonChartProps) {
  const { t } = useAppTranslation();

  if (isEmpty || !monthlyData.some((d) => d.amount > 0)) {
    return (
      <div className="h-[200px] sm:h-[220px] bg-gray-100 rounded flex items-center justify-center px-3">
        <span className="text-gray-500 text-sm text-center">
          {t("expenses.noExpenseDataForYear", "No expense data available for this year")}
        </span>
      </div>
    );
  }

  const nbsp = "\u00A0";
  const formatY = (value: number) => {
    if (value >= 1_000_000) return `Rp${nbsp}${Math.round(value / 1_000_000)}jt`;
    if (value >= 1_000) return `Rp${nbsp}${Math.round(value / 1_000)}rb`;
    return `Rp${nbsp}${value.toLocaleString("id-ID")}`;
  };

  return (
    <div className="w-full min-w-0 flex flex-col gap-1">
      <div
        className="overflow-x-auto overflow-y-hidden seamless-scroll nested-scroll-touch-chain-x"
        style={{ scrollBehavior: "smooth", WebkitOverflowScrolling: "touch" }}
      >
        <div style={{ width: CHART_MIN_WIDTH, minWidth: CHART_MIN_WIDTH }} className="h-[220px] sm:h-[240px] pr-1 flex-shrink-0">
          <ResponsiveContainer width={CHART_MIN_WIDTH} height="100%">
            <LineChart
              data={monthlyData}
              margin={{ top: 2, right: 4, left: 0, bottom: 0 }}
            >
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
                formatter={(value: number) => [
                  `Rp ${value.toLocaleString("id-ID")}`,
                  t("expenses.expensesLegend", "Expenses"),
                ]}
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
                stroke="#3B82F6"
                strokeWidth={2}
                dot={{ fill: "#3B82F6", strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="flex items-center flex-shrink-0 mt-0.5">
        <div className="w-2 h-2 bg-blue-500 rounded-full mr-1.5 flex-shrink-0" />
        <span className="text-xs text-muted-foreground">
          {t("expenses.expensesLegend", "Expenses")}
        </span>
      </div>
    </div>
  );
}
