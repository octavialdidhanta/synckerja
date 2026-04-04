import { useMemo } from "react";
import {
  useKOLAnalytics,
  useKOLAnalyticsMonthlyTrends,
  useOptimizedCampaignPerformance,
} from "@/shared/hooks/kol";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { useKOLManagementData } from "../hooks/useKOLManagementData";
import { useKOLCampaignsBrief } from "../hooks/useKOLCampaignsBrief";
import { useKolDeferredShowContent } from "../hooks/useKolDeferredShowContent";
import { KolManagementDashboardPageSkeleton } from "../skeletons/KolManagementDashboardPageSkeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { KOLDashboardAnalyticsTabs, type PlatformChartRow } from "./KOLDashboardAnalyticsTabs";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import {
  TrendingUp,
  Users,
  Eye,
  MessageCircle,
  Megaphone,
  CheckCircle2,
  Wallet,
  Target,
} from "lucide-react";

/** Slice pie / dot platform — seluruhnya hue biru brand (variasi saturasi/terang). */
const PLATFORM_COLORS = [
  "hsl(204 70% 42%)",
  "hsl(204 65% 52%)",
  "hsl(204 72% 36%)",
  "hsl(204 58% 48%)",
  "hsl(204 55% 58%)",
  "hsl(204 50% 34%)",
];

const fmtInt = (n: number) =>
  Number.isFinite(n) ? Math.round(n).toLocaleString("id-ID", { maximumFractionDigits: 0 }) : "0";

const fmtDecimal = (n: number, fractionDigits = 1) =>
  Number.isFinite(n)
    ? n.toLocaleString("id-ID", { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits })
    : "0";

const fmtRp = (n: number) =>
  Number.isFinite(n) ? `Rp ${Math.round(n).toLocaleString("id-ID", { maximumFractionDigits: 0 })}` : "Rp 0";

export const EnhancedKOLDashboard = () => {
  const { t } = useAppTranslation();
  const { loading: orgLoading, organizationId } = useCurrentOrg();
  const { data: campaignPerformance, isPending: campaignPending } = useOptimizedCampaignPerformance();
  const { data: analytics, isPending: analyticsPending } = useKOLAnalytics();
  const { data: monthlyTrends = [], isPending: monthlyPending } = useKOLAnalyticsMonthlyTrends();
  const { data: campaignsBrief, isPending: briefPending } = useKOLCampaignsBrief();
  const { filteredProfiles, isPending: profilesPending } = useKOLManagementData({
    search: "",
    category: "all",
    platform: "all",
    status: "all",
    performance: "all",
  });

  /** `isPending` saja: refetch background tidak memicu skeleton. */
  const queriesPending =
    Boolean(organizationId) &&
    (campaignPending || analyticsPending || monthlyPending || briefPending || profilesPending);

  const rawPending = orgLoading || queriesPending;
  const showContent = useKolDeferredShowContent(rawPending);

  const performanceChartData = useMemo(
    () => monthlyTrends.map((m) => ({ name: m.name, reach: m.reach, engagement: m.engagement })),
    [monthlyTrends],
  );

  const platformData: PlatformChartRow[] = useMemo(() => {
    if (!analytics?.platformBreakdown || analytics.platformBreakdown.length === 0) {
      return [];
    }
    const totalFollowers = analytics.platformBreakdown.reduce((sum, p) => sum + p.followers, 0);
    return analytics.platformBreakdown.map((platform, index) => ({
      name: platform.platform,
      value: totalFollowers > 0 ? Math.round((platform.followers / totalFollowers) * 100) : 0,
      color: PLATFORM_COLORS[index % PLATFORM_COLORS.length],
      followers: platform.followers,
      engagement: platform.engagement,
    }));
  }, [analytics]);

  const overviewStats = useMemo(() => {
    if (!analytics) {
      return [
        {
          title: t("kolManagement.dashboard.kpi.totalReach", "Total reach"),
          value: fmtInt(0),
          sub: "+0%",
          icon: Eye,
          accent: "text-primary",
        },
        {
          title: t("kolManagement.dashboard.kpi.totalEngagement", "Total engagement"),
          value: fmtInt(0),
          sub: "+0%",
          icon: MessageCircle,
          accent: "text-brand-blue-deep",
        },
        {
          title: t("kolManagement.dashboard.kpi.activeKols", "Active KOLs"),
          value: fmtInt(0),
          sub: "+0",
          icon: Users,
          accent: "text-info",
        },
        {
          title: t("kolManagement.dashboard.kpi.conversionRate", "Conversion rate"),
          value: `${fmtDecimal(0)}%`,
          sub: "+0%",
          icon: TrendingUp,
          accent: "text-brand-blue-on-soft",
        },
      ];
    }
    const activeKOLs = filteredProfiles?.filter((p) => p.status === "active").length || 0;
    const conversionRate =
      analytics.totalReach > 0 ? ((analytics.totalConversions / analytics.totalReach) * 100).toFixed(1) : "0";

    return [
      {
        title: t("kolManagement.dashboard.kpi.totalReach", "Total reach"),
        value: fmtInt(analytics.totalReach),
        sub: "+0%",
        icon: Eye,
        accent: "text-primary",
      },
      {
        title: t("kolManagement.dashboard.kpi.totalEngagement", "Total engagement"),
        value: fmtInt(Math.round(analytics.totalEngagement)),
        sub: "+0%",
        icon: MessageCircle,
        accent: "text-brand-blue-deep",
      },
      {
        title: t("kolManagement.dashboard.kpi.activeKols", "Active KOLs"),
        value: fmtInt(activeKOLs),
        sub: "+0",
        icon: Users,
        accent: "text-info",
      },
      {
        title: t("kolManagement.dashboard.kpi.conversionRate", "Conversion rate"),
        value: `${fmtDecimal(Number(conversionRate))}%`,
        sub: "+0%",
        icon: TrendingUp,
        accent: "text-brand-blue-on-soft",
      },
    ];
  }, [analytics, filteredProfiles, t]);

  const secondaryStats = useMemo(() => {
    const active = campaignsBrief?.active ?? 0;
    const completed = campaignsBrief?.completed ?? 0;
    const revenue = analytics?.totalRevenue ?? 0;
    const roi = analytics?.roi ?? 0;
    const conversions = analytics?.totalConversions ?? 0;

    return [
      {
        title: t("kolManagement.dashboard.cards.activeCampaigns.title", "Active campaigns"),
        value: fmtInt(active),
        sub: t("kolManagement.dashboard.cards.activeCampaigns.subtitle", "Running"),
        icon: Megaphone,
      },
      {
        title: t("kolManagement.dashboard.cards.completedCampaigns.title", "Completed campaigns"),
        value: fmtInt(completed),
        sub: t("kolManagement.dashboard.cards.completedCampaigns.subtitle", "Finished"),
        icon: CheckCircle2,
      },
      {
        title: t("kolManagement.dashboard.cards.totalConversions.title", "Total conversions"),
        value: fmtInt(conversions),
        sub: t("kolManagement.dashboard.cards.totalConversions.subtitle", "All campaigns"),
        icon: Target,
      },
      {
        title: t("kolManagement.dashboard.cards.totalRevenue.title", "Total revenue"),
        value: fmtRp(revenue),
        sub: `${t("kolManagement.dashboard.cards.totalRevenue.roi", "ROI")}: ${fmtDecimal(roi)}%`,
        icon: Wallet,
      },
    ];
  }, [analytics, campaignsBrief, t]);

  return (
    <div className="grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch">
      <div className="relative col-span-12 flex min-h-0 min-w-0 flex-col">
        {!showContent ? (
          <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain absolute inset-0 z-20 min-h-0 overflow-y-auto overflow-x-hidden bg-gray-100 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <KolManagementDashboardPageSkeleton variant="embedded" />
          </div>
        ) : null}
        <div
          className={cn(
            "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-primary/20 bg-white px-4 py-5 shadow-sm sm:px-6 sm:py-6",
            !showContent && "invisible pointer-events-none",
          )}
          aria-hidden={!showContent}
        >
          <div className="mb-6 border-b border-primary/15 pb-4">
            <h2 className="border-l-4 border-primary pl-3 text-lg font-semibold text-foreground">
              {t("kolManagement.dashboard.mergedTitle", "Ringkasan & analitik")}
            </h2>
            <p className="mt-1 pl-3 text-sm text-muted-foreground">
              {t(
                "kolManagement.dashboard.mergedDescription",
                "Metrik utama, kampanye, dan tren performa KOL dalam satu tampilan.",
              )}
            </p>
          </div>

          <div className="space-y-8">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {overviewStats.map((stat, index) => {
                const Icon = stat.icon;
                return (
                  <Card
                    key={`kpi-${index}`}
                    className="border-primary/15 shadow-sm transition-shadow hover:border-primary/25 hover:shadow-md"
                  >
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                          <p className="mt-1 text-2xl font-bold tracking-tight text-foreground">{stat.value}</p>
                          <p className={`mt-1 text-xs font-medium ${stat.accent}`}>{stat.sub}</p>
                        </div>
                        <div className="rounded-full bg-brand-blue-soft p-2.5">
                          <Icon className={`h-5 w-5 ${stat.accent}`} />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {secondaryStats.map((stat, index) => {
                const Icon = stat.icon;
                return (
                  <Card
                    key={`sec-${index}`}
                    className="border-primary/15 bg-brand-blue-soft/40 shadow-sm"
                  >
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                          <p className="mt-1 text-xl font-bold text-foreground">{stat.value}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{stat.sub}</p>
                        </div>
                        <Icon className="h-5 w-5 shrink-0 text-primary" />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <div>
              <Card className="border-primary/20 shadow-sm">
                <CardHeader className="border-b border-primary/15 bg-brand-blue-soft/35 pb-4">
                  <CardTitle className="border-l-4 border-primary pl-3 text-base font-semibold text-foreground">
                    {t("kolManagement.dashboard.analyticsSectionTitle", "Detail performa")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <KOLDashboardAnalyticsTabs
                    analytics={analytics ?? undefined}
                    campaignPerformance={campaignPerformance ?? []}
                    performanceChartData={performanceChartData}
                    platformData={platformData}
                    fmtInt={fmtInt}
                    fmtDecimal={fmtDecimal}
                  />
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
