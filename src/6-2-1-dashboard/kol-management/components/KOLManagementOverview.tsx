import { TrendingUp, Star, Target, AlertTriangle, Calendar } from "lucide-react";
import type { KOLProfileWithStats } from "../hooks/useKOLManagementData";

interface KOLManagementOverviewProps {
  metrics: {
    totalKOLs: number;
    activeKOLs: number;
    totalFollowers: number;
    totalCampaigns: number;
    activeCampaigns: number;
    avgEngagement: number;
  } | null;
  profiles: KOLProfileWithStats[];
}

export const KOLManagementOverview = ({
  metrics: passedMetrics,
  profiles: passedProfiles,
}: KOLManagementOverviewProps) => {
  const profiles = Array.isArray(passedProfiles) ? passedProfiles : [];
  const metrics = passedMetrics;

  const topPerformers = profiles
    .filter((profile) => profile && typeof profile === "object")
    .map((profile) => {
      const socialAccounts = "social_accounts" in profile ? profile.social_accounts : [];
      const engagementRate = "engagement_rate" in profile ? profile.engagement_rate : 0;
      const totalReach =
        "total_reach" in profile
          ? profile.total_reach
          : "followers_count" in profile
            ? profile.followers_count
            : 0;

      const avgEngagement =
        socialAccounts && socialAccounts.length > 0
          ? socialAccounts.reduce((sum: number, acc: any) => sum + (acc.engagement_rate || 0), 0) /
            socialAccounts.length
          : engagementRate;

      const performanceScore = Math.min(100, Math.round(avgEngagement * 20 + totalReach / 10000));

      return {
        ...profile,
        performanceScore,
        followers: totalReach,
      };
    })
    .sort((a, b) => b.performanceScore - a.performanceScore)
    .slice(0, 3);

  const lowPerformanceKOLs = (Array.isArray(profiles) ? profiles : []).filter((profile) => {
    const socialAccounts = "social_accounts" in profile ? profile.social_accounts : [];
    const engagementRate = "engagement_rate" in profile ? profile.engagement_rate : 0;
    const avgEngagement =
      socialAccounts && socialAccounts.length > 0
        ? socialAccounts.reduce((sum: number, acc: any) => sum + (acc.engagement_rate || 0), 0) /
          socialAccounts.length
        : engagementRate;
    return avgEngagement < 2;
  }).length;

  const inactiveKOLs = (Array.isArray(profiles) ? profiles : []).filter((profile) => profile.status === "inactive").length;
  const pendingKOLs = (Array.isArray(profiles) ? profiles : []).filter((profile) => profile.status === "pending").length;

  const alerts = [
    ...(lowPerformanceKOLs > 0
      ? [{ type: "warning" as const, message: "Performance below target", count: lowPerformanceKOLs }]
      : []),
    ...(inactiveKOLs > 0
      ? [{ type: "urgent" as const, message: "Inactive KOLs requiring attention", count: inactiveKOLs }]
      : []),
    ...(pendingKOLs > 0
      ? [{ type: "info" as const, message: "New applications pending", count: pendingKOLs }]
      : []),
  ];

  const recentActivities = [
    { type: "campaign" as const, message: `${metrics?.activeCampaigns || 0} active campaigns running`, time: "1 hour ago" },
    { type: "performance" as const, message: `${topPerformers.length} KOLs performing above average`, time: "3 hours ago" },
    ...(lowPerformanceKOLs > 0
      ? [{ type: "alert" as const, message: `${lowPerformanceKOLs} KOLs need performance improvement`, time: "5 hours ago" }]
      : []),
    { type: "rating" as const, message: "KOL performance metrics updated", time: "1 day ago" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-brand-blue/20 bg-brand-blue-soft p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-brand-blue-on-soft">Total Reach</p>
              <p className="text-lg font-bold text-brand-blue-deep">
                {metrics?.totalFollowers ? `${(metrics.totalFollowers / 1000000).toFixed(1)}M` : "0"}
              </p>
            </div>
            <TrendingUp className="h-4 w-4 text-brand-blue" />
          </div>
        </div>

        <div className="rounded-lg border border-brand-blue/25 bg-brand-blue/5 p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-brand-blue-on-soft">Avg Performance</p>
              <p className="text-lg font-bold text-brand-blue-deep">
                {metrics?.avgEngagement ? `${Number(metrics.avgEngagement).toFixed(1)}%` : "0%"}
              </p>
            </div>
            <Star className="h-4 w-4 text-brand-blue" />
          </div>
        </div>
      </div>

      <div>
        <h4 className="mb-3 flex items-center gap-2 text-xs font-semibold text-brand-blue-deep">
          <AlertTriangle className="h-3 w-3 text-brand-blue" />
          Manager Alerts
        </h4>
        <div className="space-y-2">
          {alerts.map((alert, index) => (
            <div
              key={index}
              className={`rounded-lg border p-2 ${
                alert.type === "urgent"
                  ? "border-red-200 bg-red-50"
                  : alert.type === "warning"
                    ? "border-amber-200 bg-amber-50"
                    : "border-brand-blue/30 bg-brand-blue-soft"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p
                    className={`truncate text-xs font-medium ${
                      alert.type === "urgent"
                        ? "text-red-900"
                        : alert.type === "warning"
                          ? "text-amber-900"
                          : "text-brand-blue-deep"
                    }`}
                  >
                    {alert.message}
                  </p>
                </div>
                <div
                  className={`ml-auto rounded bg-gray-50 px-2 py-1 text-xs font-bold ${
                    alert.type === "urgent"
                      ? "bg-red-100 text-red-800"
                      : alert.type === "warning"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-brand-blue/15 text-brand-blue-deep"
                  }`}
                >
                  {alert.count}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h4 className="mb-3 flex items-center gap-2 text-xs font-semibold text-brand-blue-deep">
          <Star className="h-3 w-3 text-brand-blue" />
          Top Performers This Month
        </h4>
        <div className="space-y-2">
          {topPerformers.map((kol) => (
            <div
              key={kol.id}
              className="rounded-lg border border-transparent bg-brand-blue-soft/50 p-2 transition-colors hover:border-brand-blue/20 hover:bg-brand-blue-soft"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-brand-blue-deep">{kol.name}</p>
                  <p className="truncate text-xs text-brand-blue/70">{kol.category || "Fashion"}</p>
                </div>
                <div className="ml-auto text-right">
                  <div className="flex items-center gap-1">
                    <Star className="h-3 w-3 fill-current text-brand-blue" />
                    <span className="text-xs font-medium text-brand-blue-deep">{kol.performanceScore}</span>
                  </div>
                  <p className="text-xs text-brand-blue/70">{(kol.followers / 1000).toFixed(0)}K followers</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h4 className="mb-3 flex items-center gap-2 text-xs font-semibold text-brand-blue-deep">
          <Calendar className="h-3 w-3 text-brand-blue" />
          Recent Activities
        </h4>
        <div className="space-y-2">
          {recentActivities.map((activity, index) => (
            <div key={index} className="rounded-lg border border-brand-blue/10 bg-brand-blue-soft/40 p-2">
              <div className="flex items-start gap-2">
                <div
                  className={`rounded p-1 ${
                    activity.type === "campaign"
                      ? "bg-brand-blue/20"
                      : activity.type === "rating"
                        ? "bg-brand-blue/15"
                        : activity.type === "alert"
                          ? "bg-amber-100"
                          : "bg-brand-blue/25"
                  }`}
                >
                  {activity.type === "campaign" ? (
                    <Target className="h-3 w-3 text-brand-blue" />
                  ) : activity.type === "rating" ? (
                    <Star className="h-3 w-3 text-brand-blue-deep" />
                  ) : activity.type === "alert" ? (
                    <AlertTriangle className="h-3 w-3 text-amber-600" />
                  ) : (
                    <TrendingUp className="h-3 w-3 text-brand-blue" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="leading-tight text-xs text-brand-blue-deep">{activity.message}</p>
                  <p className="mt-0.5 text-xs text-brand-blue/70">{activity.time}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h4 className="text-xs font-semibold text-brand-blue-deep">Performance Summary</h4>
        <div className="mt-3 rounded-lg border border-brand-blue/25 bg-gradient-to-r from-brand-blue-soft to-brand-blue/10 p-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-brand-blue/80">Active KOLs</p>
              <p className="text-sm font-bold text-brand-blue-deep">{metrics?.activeKOLs || 0}</p>
            </div>
            <div>
              <p className="text-xs text-brand-blue/80">Total Campaigns</p>
              <p className="text-sm font-bold text-brand-blue-deep">{metrics?.totalCampaigns || 0}</p>
            </div>
          </div>
          <div className="mt-2 border-t border-brand-blue/20 pt-2">
            <p className="text-xs text-brand-blue/80">
              <span className="font-medium text-brand-blue">{metrics?.activeCampaigns || 0} active campaigns</span>{" "}
              running this month
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

