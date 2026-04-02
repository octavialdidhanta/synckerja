import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Card } from "@/shared/components/ui/card";
import { TrendingUp } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { EmployeeGrowthData } from "@/10-subscription/hooks/useSubscriptionAnalytics";

interface EmployeeGrowthChartProps {
  data: EmployeeGrowthData[];
  isLoading?: boolean;
}

export const EmployeeGrowthChart = memo(function EmployeeGrowthChart({
  data,
  isLoading,
}: EmployeeGrowthChartProps) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <Card className="min-w-0 max-w-full overflow-hidden p-4">
        <div className="space-y-2">
          <div className="h-4 w-24 animate-pulse rounded bg-muted" />
          <div className="h-3 w-32 animate-pulse rounded bg-muted" />
        </div>
        <div className="mt-3 h-44 animate-pulse rounded bg-muted/60" />
      </Card>
    );
  }

  if (!data?.length) {
    return (
      <Card className="min-w-0 max-w-full overflow-hidden p-4">
        <div className="flex items-center gap-2 text-base font-semibold">
          <TrendingUp className="h-4 w-4" />
          {t("subscription.overview.employeeGrowth")}
        </div>
        <p className="mt-3 text-sm text-muted-foreground">{t("subscription.overview.noEmployeeGrowthData")}</p>
      </Card>
    );
  }

  return (
    <Card className="min-w-0 max-w-full overflow-hidden p-4">
      <div className="flex items-center gap-2 text-base font-semibold">
        <TrendingUp className="h-4 w-4" />
        {t("subscription.overview.employeeGrowth")}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{t("subscription.overview.employeeGrowthSubtitle")}</p>
      <div className="mt-3 h-44 w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="month" fontSize={10} stroke="#94a3b8" tickLine={false} axisLine={false} />
            <YAxis fontSize={10} stroke="#94a3b8" tickLine={false} axisLine={false} width={32} />
            <Tooltip contentStyle={{ borderRadius: 8 }} />
            <Area type="monotone" dataKey="count" stroke="hsl(204 70% 42%)" fill="hsl(204 70% 42%)" fillOpacity={0.3} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
});
