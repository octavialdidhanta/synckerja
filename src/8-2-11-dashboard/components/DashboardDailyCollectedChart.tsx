import { Link } from "react-router-dom";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { formatSalesSummaryMoney } from "@/8-2-10-reports/sales-summary/lib/computeSalesSummaryDisplay";
import { REPORTS_SALES_SUMMARY_PATH } from "@/8-2-10-reports/layout/reportsTabs";
import type { SalesSummaryDailyPoint } from "../hooks/useSalesSummaryDaily";

type Props = {
  points: SalesSummaryDailyPoint[];
};

function formatDayLabel(ymd: string): string {
  const d = new Date(`${ymd}T12:00:00`);
  if (Number.isNaN(d.getTime())) return ymd;
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

export function DashboardDailyCollectedChart({ points }: Props) {
  const { t } = useAppTranslation();
  const chartData = points.map((p) => ({
    day: p.day,
    label: formatDayLabel(p.day),
    totalCollected: p.totalCollected,
  }));
  const hasValue = chartData.some((p) => p.totalCollected > 0);

  return (
    <div className="flex min-h-[280px] flex-1 flex-col rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            {t("operationsDashboard.chart.title", "Total Collected (daily)")}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t(
              "operationsDashboard.chart.subtitle",
              "This month across all outlets (WIB).",
            )}
          </p>
        </div>
        <Link
          to={REPORTS_SALES_SUMMARY_PATH}
          className="flex-shrink-0 text-xs font-medium text-primary hover:underline"
        >
          {t("operationsDashboard.chart.openReports", "Open Sales Summary")}
        </Link>
      </div>

      {!hasValue ? (
        <div className="flex flex-1 items-center justify-center py-10 text-center">
          <p className="text-sm text-muted-foreground">
            {t(
              "operationsDashboard.chart.empty",
              "No collected sales in this period yet.",
            )}
          </p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={240} className="max-w-full min-w-0">
          <LineChart data={chartData} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="label"
              fontSize={10}
              stroke="#6b7280"
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              fontSize={10}
              stroke="#6b7280"
              tickLine={false}
              width={58}
              tickFormatter={(value) => {
                const n = Number(value);
                if (n >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(1)}jt`;
                if (n >= 1_000) return `Rp ${(n / 1_000).toFixed(0)}rb`;
                return `Rp ${n.toLocaleString("id-ID")}`;
              }}
            />
            <Tooltip
              formatter={(value: number) => [
                formatSalesSummaryMoney(Number(value)),
                t("operationsDashboard.cards.totalCollected", "Total Collected"),
              ]}
              labelFormatter={(_, payload) => {
                const day = payload?.[0]?.payload?.day as string | undefined;
                return day ? formatDayLabel(day) : "";
              }}
              contentStyle={{
                backgroundColor: "white",
                border: "1px solid #e5e7eb",
                borderRadius: "6px",
                fontSize: "12px",
              }}
            />
            <Line
              type="monotone"
              dataKey="totalCollected"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={{ fill: "hsl(var(--primary))", strokeWidth: 2, r: 3 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
