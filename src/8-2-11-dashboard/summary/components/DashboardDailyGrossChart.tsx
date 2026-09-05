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
import type { SalesSummaryDailyPoint } from "../../hooks/useSalesSummaryDaily";
import { formatDashboardMoneyTick } from "../../shared/lib/dashboardChartFormat";

type Props = {
  points: SalesSummaryDailyPoint[];
};

function dayLabel(day: string): string {
  const date = new Date(`${day}T12:00:00`);
  return Number.isNaN(date.getTime())
    ? day
    : date.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

export function DashboardDailyGrossChart({ points }: Props) {
  const { t } = useAppTranslation();
  const data = points.map((point) => ({ ...point, label: dayLabel(point.day) }));
  const hasValue = data.some((point) => point.grossSales > 0);

  return (
    <section className="min-h-[300px] rounded-lg border border-border bg-card p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-foreground">
        {t("operationsDashboard.charts.dailyGross", "DAILY GROSS SALES AMOUNT")}
      </h2>
      {!hasValue ? (
        <div className="flex h-60 items-center justify-center text-sm text-muted-foreground">
          {t("operationsDashboard.charts.empty", "No sales data for this period.")}
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={data} margin={{ top: 12, right: 12, left: 4, bottom: 0 }}>
            <defs>
              <linearGradient id="dailyGrossFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.03} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="label" fontSize={10} tickLine={false} />
            <YAxis domain={[0, "auto"]} width={62} fontSize={10} tickFormatter={formatDashboardMoneyTick} tickLine={false} />
            <Tooltip formatter={(value: number) => [formatSalesSummaryMoney(Number(value)), t("operationsDashboard.cards.grossSales", "Gross Sales")]} />
            <Area type="monotone" dataKey="grossSales" stroke="#3B82F6" fill="url(#dailyGrossFill)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </section>
  );
}
