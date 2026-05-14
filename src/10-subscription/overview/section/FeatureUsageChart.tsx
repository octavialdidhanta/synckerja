import { memo, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { BarChart3 } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  type TooltipProps,
  XAxis,
  YAxis,
} from "recharts";
import type { FeatureUsageData } from "@/10-subscription/hooks/useSubscriptionAnalytics";

interface FeatureUsageChartProps {
  data: FeatureUsageData[];
  isLoading?: boolean;
}

const Y_LABEL_MAX = 22;

function truncateYLabel(value: string) {
  if (!value) return "";
  return value.length > Y_LABEL_MAX ? `${value.slice(0, Y_LABEL_MAX - 1)}…` : value;
}

export const FeatureUsageChart = memo(function FeatureUsageChart({ data, isLoading }: FeatureUsageChartProps) {
  const { t } = useTranslation();

  const chartHeightPx = useMemo(() => {
    const n = data?.length ?? 0;
    if (n <= 0) return 0;
    return Math.min(220, Math.max(104, n * 28 + 40));
  }, [data?.length]);

  const maxUsage = useMemo(() => data.reduce((m, r) => Math.max(m, r.usage || 0), 0), [data]);

  const xDomainMax = useMemo(() => Math.max(1, maxUsage), [maxUsage]);

  const FeatureUsageTooltip = useCallback(
    ({ active, payload }: TooltipProps<number, string>) => {
      if (!active || !payload?.length) return null;
      const row = payload[0].payload as FeatureUsageData;
      return (
        <div className="max-w-[240px] rounded-md border border-border bg-popover px-2 py-1.5 text-xs text-popover-foreground shadow-md">
          <p className="font-medium text-foreground">{row.feature}</p>
          <p className="mt-0.5 text-muted-foreground">
            {t("subscription.overview.featureUsageTooltipEvents", { count: row.usage })}
          </p>
          <p className="text-muted-foreground">
            {t("subscription.overview.featureUsageTooltipUniqueUsers", { count: row.unique_users })}
          </p>
        </div>
      );
    },
    [t],
  );

  if (isLoading) {
    return (
      <Card className="min-w-0 max-w-full overflow-hidden">
        <CardHeader className="min-w-0 space-y-0.5 p-3 pb-2">
          <div className="h-4 w-32 animate-pulse rounded bg-muted" />
          <div className="h-3 w-52 max-w-full animate-pulse rounded bg-muted" />
        </CardHeader>
        <CardContent className="min-w-0 p-3 pt-0">
          <div className="h-36 animate-pulse rounded bg-muted/60" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="min-w-0 max-w-full overflow-hidden">
      <CardHeader className="min-w-0 space-y-0.5 p-3 pb-2">
        <CardTitle className="flex min-w-0 items-center gap-1.5 text-sm font-semibold leading-tight tracking-normal">
          <BarChart3 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          {t("subscription.overview.featureUsageTitle")}
        </CardTitle>
        <CardDescription className="min-w-0 text-xs leading-snug">
          {t("subscription.overview.featureUsageDescription")}
        </CardDescription>
      </CardHeader>
      <CardContent className="min-w-0 p-3 pt-0">
        {data.length === 0 ? (
          <p className="py-1 text-xs text-muted-foreground">{t("subscription.overview.featureUsageEmpty")}</p>
        ) : (
          <>
            <div className="w-full min-w-0" style={{ height: chartHeightPx }}>
              <ResponsiveContainer width="100%" height="100%">
                {/*
                  Recharts: `layout="vertical"` draws horizontal bars (value on X, category on Y).
                  `layout="horizontal"` is for vertical columns — it breaks this chart.
                */}
                <BarChart
                  data={data}
                  layout="vertical"
                  margin={{ top: 2, right: 28, bottom: 2, left: 0 }}
                  barCategoryGap={4}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-muted" />
                  <XAxis
                    type="number"
                    fontSize={9}
                    tickLine={false}
                    axisLine={false}
                    tickMargin={2}
                    height={22}
                    allowDecimals={false}
                    domain={[0, xDomainMax]}
                    tickFormatter={(v) => String(Math.round(Number(v)))}
                  />
                  <YAxis
                    dataKey="feature"
                    type="category"
                    width={88}
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    tickMargin={2}
                    tickFormatter={truncateYLabel}
                    interval={0}
                  />
                  <Tooltip cursor={{ fill: "hsl(var(--muted) / 0.35)" }} content={FeatureUsageTooltip} />
                  <Bar dataKey="usage" fill="#1d4ed8" radius={[0, 3, 3, 0]} maxBarSize={20} isAnimationActive={false}>
                    <LabelList
                      dataKey="usage"
                      position="right"
                      fill="hsl(var(--foreground))"
                      fontSize={10}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
              {t("subscription.overview.featureUsageFootnote")}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
});
