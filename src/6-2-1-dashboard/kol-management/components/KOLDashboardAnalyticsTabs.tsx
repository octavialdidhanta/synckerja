import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import {
  BarChart,
  Bar,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import type { KOLAnalyticsData, CampaignPerformanceData } from "@/shared/hooks/kol";

/** Bar chart — dua seri dalam keluarga biru brand (bukan hijau). */
const CHART_REACH = "hsl(204 70% 42%)";
const CHART_ENGAGEMENT = "hsl(204 72% 36%)";

export type PlatformChartRow = {
  name: string;
  value: number;
  color: string;
  followers: number;
  engagement: number;
};

type Props = {
  analytics: KOLAnalyticsData | null | undefined;
  campaignPerformance: CampaignPerformanceData[];
  performanceChartData: { name: string; reach: number; engagement: number }[];
  platformData: PlatformChartRow[];
  fmtInt: (n: number) => string;
  fmtDecimal: (n: number, fractionDigits?: number) => string;
};

/**
 * Bagian tab analitik (tren, platform, kampanye, engagement) — data dari parent.
 */
export function KOLDashboardAnalyticsTabs({
  analytics,
  campaignPerformance,
  performanceChartData,
  platformData,
  fmtInt,
  fmtDecimal,
}: Props) {
  const safeCampaignPerformance = Array.isArray(campaignPerformance) ? campaignPerformance : [];

  return (
    <Tabs defaultValue="overview" className="w-full">
      <TabsList className="grid w-full max-w-xl grid-cols-3 bg-brand-blue-soft/70 p-1 text-brand-blue-on-soft sm:inline-flex sm:w-auto sm:max-w-none">
        <TabsTrigger
          value="overview"
          className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
        >
          Overview
        </TabsTrigger>
        <TabsTrigger
          value="performance"
          className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
        >
          Performance
        </TabsTrigger>
        <TabsTrigger
          value="engagement"
          className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
        >
          Engagement
        </TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="mt-6 space-y-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card className="border-primary/20 shadow-sm">
            <CardHeader className="border-b border-primary/10 bg-brand-blue-soft/30 pb-2">
              <CardTitle className="border-l-4 border-primary pl-3 text-base font-semibold text-foreground">
                Performance Trends
              </CardTitle>
            </CardHeader>
            <CardContent>
              {performanceChartData.length === 0 ||
              performanceChartData.every((r) => r.reach === 0 && r.engagement === 0) ? (
                <div className="flex h-[300px] items-center justify-center px-2 text-center text-sm text-muted-foreground">
                  Belum ada data performa per bulan (isi metrik pada content post atau tunggu tanggal post /
                  konversi dalam 6 bulan terakhir).
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={performanceChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(204 70% 42% / 0.12)" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tickFormatter={(v) => fmtInt(Number(v))} tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(value: number | string) => fmtInt(Number(value))}
                      labelFormatter={(label) => String(label)}
                      contentStyle={{ borderRadius: 8, borderColor: "hsl(204 70% 42% / 0.2)" }}
                    />
                    <Bar dataKey="reach" fill={CHART_REACH} name="Reach" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="engagement" fill={CHART_ENGAGEMENT} name="Engagement" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card className="border-primary/20 shadow-sm">
            <CardHeader className="border-b border-primary/10 bg-brand-blue-soft/30 pb-2">
              <CardTitle className="border-l-4 border-primary pl-3 text-base font-semibold text-foreground">
                Platform Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              {platformData.length === 0 ? (
                <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
                  Tidak ada data platform
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={platformData}
                      cx="50%"
                      cy="50%"
                      outerRadius={88}
                      fill="hsl(204 70% 42%)"
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}%`}
                    >
                      {platformData.map((entry, idx) => (
                        <Cell key={`cell-${idx}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => `${v}%`} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="border-primary/20 shadow-sm">
          <CardHeader className="border-b border-primary/10 bg-brand-blue-soft/30 pb-2">
            <CardTitle className="border-l-4 border-primary pl-3 text-base font-semibold text-foreground">
              Campaign Performance Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-primary/10">
              {safeCampaignPerformance.slice(0, 5).map((campaign) => (
                <div key={campaign.campaign_id} className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <h4 className="font-medium text-foreground">{campaign.campaign_name}</h4>
                    <p className="text-sm text-muted-foreground">
                      {fmtInt(campaign.total_kols)} KOLs · {fmtInt(campaign.total_reach)} reach
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-semibold text-primary">{fmtDecimal(campaign.avg_engagement_rate)}%</p>
                    <p className="text-xs text-muted-foreground">Engagement rate</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="performance" className="mt-6 space-y-6">
        <Card className="border-primary/20 shadow-sm">
          <CardHeader className="border-b border-primary/10 bg-brand-blue-soft/30 pb-2">
            <CardTitle className="border-l-4 border-primary pl-3 text-base font-semibold text-foreground">
              Kampanye & performa
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-primary/10">
              {safeCampaignPerformance.slice(0, 10).map((campaign) => (
                <div
                  key={campaign.campaign_id}
                  className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <h4 className="font-medium text-foreground">{campaign.campaign_name}</h4>
                    <p className="text-sm text-muted-foreground">
                      {fmtInt(campaign.total_kols)} KOLs · {fmtInt(campaign.total_reach)} reach
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-semibold text-primary">{fmtDecimal(campaign.avg_engagement_rate)}%</p>
                    <p className="text-xs text-muted-foreground">Engagement rate</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="engagement" className="mt-6 space-y-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card className="border-primary/20 shadow-sm">
            <CardHeader className="border-b border-primary/10 bg-brand-blue-soft/30 pb-2">
              <CardTitle className="border-l-4 border-primary pl-3 text-base font-semibold text-foreground">
                Engagement rate per platform
              </CardTitle>
            </CardHeader>
            <CardContent>
              {platformData.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">Tidak ada data platform</div>
              ) : (
                <div className="space-y-4">
                  {platformData.map((platform) => {
                    const engagementRate =
                      platform.followers > 0 ? ((platform.engagement / platform.followers) * 100).toFixed(1) : "0";
                    return (
                      <div key={platform.name} className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: platform.color }} />
                          <span className="truncate font-medium text-foreground">{platform.name}</span>
                        </div>
                        <div className="shrink-0 text-right">
                          <span className="font-semibold text-primary">{fmtDecimal(Number(engagementRate))}%</span>
                          <p className="text-xs text-muted-foreground">{fmtInt(platform.followers)} followers</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-primary/20 shadow-sm">
            <CardHeader className="border-b border-primary/10 bg-brand-blue-soft/30 pb-2">
              <CardTitle className="border-l-4 border-primary pl-3 text-base font-semibold text-foreground">
                Top performing KOLs
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!analytics?.topPerformingKOLs || analytics.topPerformingKOLs.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">Belum ada data KOL</div>
              ) : (
                <div className="divide-y divide-primary/10">
                  {analytics.topPerformingKOLs.slice(0, 5).map((kol) => (
                    <div key={kol.id} className="flex items-center justify-between gap-3 py-4 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <span className="font-medium text-foreground">{kol.name}</span>
                        <p className="text-sm text-muted-foreground">{fmtInt(kol.totalReach)} reach</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <span className="font-semibold text-primary">{fmtDecimal(kol.engagementRate)}%</span>
                        <p className="text-xs text-muted-foreground">{fmtInt(kol.conversions)} konversi</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </TabsContent>
    </Tabs>
  );
}
