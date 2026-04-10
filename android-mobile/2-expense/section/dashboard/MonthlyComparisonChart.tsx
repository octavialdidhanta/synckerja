import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import type { MonthlyDataItem } from "@/shared/hooks/finance/useMonthlyExpenseData";

export interface MonthlyComparisonChartProps {
  monthlyData: MonthlyDataItem[];
  isEmpty?: boolean;
}

const CHART_MIN_WIDTH = 528;

export function MonthlyComparisonChart({ monthlyData, isEmpty }: MonthlyComparisonChartProps) {
  const { t } = useAppTranslation();

  if (isEmpty || !monthlyData.some((d) => d.amount > 0)) {
    return (
      <div className="flex h-[200px] items-center justify-center rounded bg-gray-100 px-3 sm:h-[220px]">
        <span className="text-center text-sm text-gray-500">
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
    <div className="flex min-w-0 w-full flex-col gap-1">
      <div
        className="scrollbar-hide nested-scroll-touch-chain-x seamless-scroll overflow-x-auto overflow-y-hidden"
        style={{ scrollBehavior: "smooth", WebkitOverflowScrolling: "touch" }}
      >
        <div
          style={{ width: CHART_MIN_WIDTH, minWidth: CHART_MIN_WIDTH }}
          className="h-[220px] flex-shrink-0 pr-1 sm:h-[240px]"
        >
          <ResponsiveContainer width={CHART_MIN_WIDTH} height="100%">
            <LineChart data={monthlyData} margin={{ top: 2, right: 4, left: 0, bottom: 0 }}>
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
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ fill: "hsl(var(--primary))", strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="mt-0.5 flex flex-shrink-0 items-center">
        <div className="mr-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-primary" />
        <span className="text-xs text-muted-foreground">{t("expenses.expensesLegend", "Expenses")}</span>
      </div>
    </div>
  );
}
