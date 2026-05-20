import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  CartesianGrid,
} from "recharts";

export type MonthlyTrendPoint = {
  month: string;
  value: number;
};

type IncomeDashboardMonthlyTrendChartProps = {
  data: MonthlyTrendPoint[];
};

export function IncomeDashboardMonthlyTrendChart({ data }: IncomeDashboardMonthlyTrendChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-full min-h-[120px] items-center justify-center rounded bg-gray-100">
        <span className="text-sm text-gray-500">No income data available for this year</span>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={240} className="max-w-full min-w-0">
      <LineChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          dataKey="month"
          tickFormatter={(value) => value.split(" ")[0]}
          fontSize={10}
          stroke="#6b7280"
          tickLine={false}
        />
        <YAxis
          fontSize={10}
          stroke="#6b7280"
          tickLine={false}
          width={58}
          tick={{ style: { whiteSpace: "nowrap" } }}
          tickFormatter={(value) => {
            const nbsp = "\u00A0";
            if (value >= 1000000) return `Rp${nbsp}${(value / 1000000).toFixed(1)}jt`;
            if (value >= 1000) return `Rp${nbsp}${(value / 1000).toFixed(0)}rb`;
            return `Rp${nbsp}${value.toLocaleString("id-ID")}`;
          }}
        />
        <Tooltip
          formatter={(value: number) => [`Rp ${Number(value).toLocaleString("id-ID")}`, "Income"]}
          contentStyle={{
            backgroundColor: "white",
            border: "1px solid #e5e7eb",
            borderRadius: "6px",
            fontSize: "12px",
          }}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke="hsl(var(--brand-blue))"
          strokeWidth={2}
          dot={{ fill: "hsl(var(--brand-blue))", strokeWidth: 2, r: 3 }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
