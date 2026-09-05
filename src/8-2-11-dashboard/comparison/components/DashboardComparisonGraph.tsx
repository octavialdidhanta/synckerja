import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatSalesSummaryMoney } from "@/8-2-10-reports/sales-summary/lib/computeSalesSummaryDisplay";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { formatDashboardMoneyTick } from "../../shared/lib/dashboardChartFormat";
import type {
  DashboardComparisonMetricKey,
  DashboardOutletComparisonRow,
} from "../hooks/useDashboardOutletComparison";

type Props = {
  rows: DashboardOutletComparisonRow[];
};

const METRIC_KEYS: DashboardComparisonMetricKey[] = [
  "grossSales",
  "netSales",
  "grossProfit",
  "transactionCount",
  "avgSale",
  "grossMargin",
];

export function DashboardComparisonGraph({ rows }: Props) {
  const { t } = useAppTranslation();
  const [metric, setMetric] = useState<DashboardComparisonMetricKey>("grossSales");

  const labels: Record<DashboardComparisonMetricKey, string> = {
    grossSales: t("operationsDashboard.cards.grossSales", "Gross Sales"),
    netSales: t("operationsDashboard.cards.netSales", "Net Sales"),
    grossProfit: t("operationsDashboard.cards.grossProfit", "Gross Profit"),
    transactionCount: t("operationsDashboard.cards.transactions", "Transaction"),
    avgSale: t("operationsDashboard.compare.avgSaleShort", "Avg Sale"),
    grossMargin: t("operationsDashboard.cards.grossMargin", "Gross Margin"),
  };

  const chartData = rows.map((row) => ({
    name: row.outletName,
    value: row[metric],
  }));
  const hasValue = chartData.some((point) => point.value > 0);
  const isMoney = metric !== "transactionCount" && metric !== "grossMargin";

  return (
    <section className="min-h-[320px] rounded-lg border border-border bg-card p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-foreground">
        {t("operationsDashboard.compare.graphTitle", "GRAPH COMPARISON")}
      </h2>
      <div className="mb-4 flex flex-wrap gap-2">
        {METRIC_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setMetric(key)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              metric === key
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-muted-foreground hover:text-foreground",
            )}
          >
            {labels[key]}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="flex h-60 items-center justify-center text-sm text-muted-foreground">
          {t(
            "operationsDashboard.compare.graphEmpty",
            "Choose outlets to see comparison chart.",
          )}
        </div>
      ) : !hasValue ? (
        <div className="flex h-60 items-center justify-center text-sm text-muted-foreground">
          {t("operationsDashboard.charts.empty", "No sales data for this period.")}
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData} margin={{ top: 12, right: 12, left: 4, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="name" fontSize={10} tickLine={false} interval={0} />
            <YAxis
              domain={[0, "auto"]}
              width={62}
              fontSize={10}
              tickLine={false}
              tickFormatter={(value: number) => {
                if (metric === "grossMargin") return `${Number(value).toFixed(0)}%`;
                if (metric === "transactionCount") return Number(value).toLocaleString("id-ID");
                return formatDashboardMoneyTick(Number(value));
              }}
            />
            <Tooltip
              formatter={(value: number) => {
                if (metric === "grossMargin") {
                  return [
                    `${Number(value).toLocaleString("id-ID", {
                      minimumFractionDigits: 1,
                      maximumFractionDigits: 1,
                    })}%`,
                    labels[metric],
                  ];
                }
                if (metric === "transactionCount") {
                  return [Number(value).toLocaleString("id-ID"), labels[metric]];
                }
                return [formatSalesSummaryMoney(Number(value)), labels[metric]];
              }}
            />
            <Bar
              dataKey="value"
              fill="#3B82F6"
              radius={[4, 4, 0, 0]}
              name={isMoney ? labels[metric] : labels[metric]}
            />
          </BarChart>
        </ResponsiveContainer>
      )}
    </section>
  );
}
