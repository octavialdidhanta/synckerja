import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatSalesSummaryMoney } from "@/8-2-10-reports/sales-summary/lib/computeSalesSummaryDisplay";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { formatDashboardMoneyTick } from "../../shared/lib/dashboardChartFormat";
import type { DashboardHourlyPoint } from "../hooks/useDashboardTimeSeries";

type Props = {
  points: DashboardHourlyPoint[];
};

export function DashboardHourlyGrossChart({ points }: Props) {
  const { t } = useAppTranslation();
  const data = points.map((point) => ({
    ...point,
    label: `${String(point.hour).padStart(2, "0")}:00`,
  }));
  const hasValue = data.some((point) => point.grossSales > 0);
  return (
    <section className="min-h-[300px] rounded-lg border border-border bg-card p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-foreground">
        {t("operationsDashboard.charts.hourlyGross", "GROSS SALES BY HOUR")}
      </h2>
      {!hasValue ? (
        <div className="flex h-60 items-center justify-center text-sm text-muted-foreground">
          {t("operationsDashboard.charts.empty", "No sales data for this period.")}
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={data} margin={{ top: 12, right: 12, left: 4, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="label" fontSize={10} interval={2} tickLine={false} />
            <YAxis domain={[0, "auto"]} width={62} fontSize={10} tickFormatter={formatDashboardMoneyTick} tickLine={false} />
            <Tooltip formatter={(value: number) => [formatSalesSummaryMoney(Number(value)), t("operationsDashboard.cards.grossSales", "Gross Sales")]} />
            <Area type="monotone" dataKey="grossSales" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.16} strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </section>
  );
}
