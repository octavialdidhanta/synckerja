import { Card } from "@/mobile/components/ui/card";
import { BarChart3 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useAppTranslation } from "@/features/share/i18n/useAppTranslation";

interface ChartData {
  month: string;
  hadir: number;
  terlambat: number;
  tidakHadir: number;
}

interface AttendanceChartProps {
  chartData: ChartData[];
}

export const AttendanceChart = ({ chartData }: AttendanceChartProps) => {
  const { t } = useAppTranslation();
  return (
    <Card className="bg-gradient-card border border-border">
      <div className="px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">{t("reports.attendanceChartTitle", "Grafik Kehadiran")}</h2>
        </div>
      </div>
      <div className="px-2 pt-1 pb-2">
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} margin={{ top: 5, right: 5, left: 2, bottom: 2 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="month" 
                stroke="hsl(var(--muted-foreground))"
                fontSize={10}
                tick={{ fontSize: 10 }}
              />
              <YAxis 
                stroke="hsl(var(--muted-foreground))"
                fontSize={10}
                tick={{ fontSize: 10 }}
                width={30}
                allowDecimals={false}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "6px",
                  fontSize: "12px"
                }}
              />
              <Bar 
                dataKey="hadir" 
                name={t("reports.status.present", "Hadir")}
                fill="hsl(var(--success))"
                radius={[1, 1, 0, 0]}
              />
              <Bar 
                dataKey="terlambat" 
                name={t("reports.status.late", "Terlambat")}
                fill="hsl(var(--warning))"
                radius={[1, 1, 0, 0]}
              />
              <Bar 
                dataKey="tidakHadir" 
                name={t("reports.status.absent", "Tidak Hadir")}
                fill="hsl(var(--destructive))"
                radius={[1, 1, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-center py-4">
            <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">
              {t("reports.chartNoData", "Belum ada data untuk ditampilkan dalam grafik")}
            </p>
          </div>
        )}
      </div>
    </Card>
  );
};