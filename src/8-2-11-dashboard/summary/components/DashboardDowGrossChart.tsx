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
import { formatDashboardMoneyTick } from "../../shared/lib/dashboardChartFormat";
import type { DashboardDowPoint } from "../hooks/useDashboardTimeSeries";

type Props = {
  points: DashboardDowPoint[];
};

export function DashboardDowGrossChart({ points }: Props) {
  const { t } = useAppTranslation();
  const hasValue = points.some((point) => point.grossSales > 0);
  return (
    <section className="min-h-[300px] rounded-lg border border-border bg-card p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-foreground">
        {t("operationsDashboard.charts.dowGross", "GROSS SALES BY DAY OF WEEK")}
      </h2>
      {!hasValue ? (
        <div className="flex h-60 items-center justify-center text-sm text-muted-foreground">
          {t("operationsDashboard.charts.empty", "No sales data for this period.")}
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={points} margin={{ top: 12, right: 12, left: 4, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="label" fontSize={10} tickLine={false} />
            <YAxis domain={[0, "auto"]} width={62} fontSize={10} tickFormatter={formatDashboardMoneyTick} tickLine={false} />
            <Tooltip formatter={(value: number) => [formatSalesSummaryMoney(Number(value)), t("operationsDashboard.cards.grossSales", "Gross Sales")]} />
            <Bar dataKey="grossSales" fill="#3B82F6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </section>
  );
}
