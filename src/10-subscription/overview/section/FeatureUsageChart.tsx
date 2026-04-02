import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { BarChart3 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { FeatureUsageData } from "@/10-subscription/hooks/useSubscriptionAnalytics";

interface FeatureUsageChartProps {
  data: FeatureUsageData[];
  isLoading?: boolean;
}

export const FeatureUsageChart = memo(function FeatureUsageChart({ data, isLoading }: FeatureUsageChartProps) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <Card className="min-w-0 max-w-full overflow-hidden">
        <CardHeader>
          <div className="h-5 w-32 animate-pulse rounded bg-muted" />
          <div className="h-4 w-48 animate-pulse rounded bg-muted" />
        </CardHeader>
        <CardContent>
          <div className="h-64 animate-pulse rounded bg-muted/60" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="min-w-0 max-w-full overflow-hidden">
      <CardHeader className="min-w-0">
        <CardTitle className="flex min-w-0 items-center gap-2">
          <BarChart3 className="h-5 w-5 shrink-0" />
          {t("subscription.overview.featureUsageTitle")}
        </CardTitle>
        <CardDescription className="min-w-0">{t("subscription.overview.featureUsageDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="min-w-0">
        <div className="h-64 w-full min-w-0 overflow-x-auto">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="horizontal" margin={{ left: 8, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis type="number" fontSize={10} />
              <YAxis dataKey="feature" type="category" width={120} fontSize={10} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 8 }} />
              <Bar dataKey="usage" fill="hsl(204 70% 42%)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
});
