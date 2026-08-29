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
import { formatGrossProfitMoney } from "../lib/computeGrossProfitDisplay";
import type { GrossProfitDailyPoint } from "../hooks/useGrossProfitDaily";

type Props = {
  points: GrossProfitDailyPoint[];
};

function formatDayLabel(ymd: string): string {
  const d = new Date(`${ymd}T12:00:00`);
  if (Number.isNaN(d.getTime())) return ymd;
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

export function GrossProfitDailyChart({ points }: Props) {
  const { t } = useAppTranslation();
  const chartData = points.map((p) => ({
    day: p.day,
    label: formatDayLabel(p.day),
    grossProfit: p.grossProfit,
  }));
  const hasValue = chartData.some((p) => p.grossProfit !== 0);

  return (
    <div className="mt-4 flex min-h-[240px] flex-col rounded-md border border-border bg-card p-4">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-foreground">
          {t("reports.grossProfit.chart.title", "Gross Profit (daily)")}
        </h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {t(
            "reports.grossProfit.chart.subtitle",
            "Daily gross profit for the selected period (WIB).",
          )}
        </p>
      </div>

      {!hasValue ? (
        <div className="flex flex-1 items-center justify-center py-8 text-center">
          <p className="text-sm text-muted-foreground">
            {t("reports.grossProfit.chart.empty", "No gross profit data in this period.")}
          </p>
        </div>
      ) : (
        <div className="h-[200px] w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis
                tick={{ fontSize: 11 }}
                width={64}
                tickFormatter={(v) => formatGrossProfitMoney(Number(v))}
              />
              <Tooltip
                formatter={(value: number | string) => [
                  formatGrossProfitMoney(Number(value)),
                  t("reports.grossProfit.grossProfit", "Gross Profit"),
                ]}
                labelFormatter={(_, payload) => {
                  const day = payload?.[0]?.payload?.day as string | undefined;
                  return day ? formatDayLabel(day) : "";
                }}
              />
              <Line
                type="monotone"
                dataKey="grossProfit"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
