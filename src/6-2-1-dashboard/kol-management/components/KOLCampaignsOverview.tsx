import { TrendingUp, Calendar, Target, DollarSign, AlertTriangle, Clock } from "lucide-react";

interface CampaignMetrics {
  totalCampaigns: number;
  activeCampaigns: number;
  totalBudget: number;
  allocatedBudget: number;
  remainingBudget: number;
}

interface KOLCampaignsOverviewProps {
  campaigns: any[];
  metrics?: CampaignMetrics | null;
}

export const KOLCampaignsOverview = ({
  campaigns: passedCampaigns,
  metrics: passedMetrics,
}: KOLCampaignsOverviewProps) => {
  const campaigns = Array.isArray(passedCampaigns) ? passedCampaigns : [];
  const metrics = passedMetrics;

  const activeCampaigns = campaigns.filter((c) => c.status === "active");
  const upcomingCampaigns = campaigns.filter((c) => c.status === "draft");
  const completedCampaigns = campaigns.filter((c) => c.status === "completed");

  const calculatedMetrics = metrics || {
    totalCampaigns: campaigns.length,
    activeCampaigns: activeCampaigns.length,
    totalBudget: campaigns.reduce((sum, c: any) => sum + (c.total_budget || 0), 0),
    allocatedBudget: campaigns.reduce((sum, c: any) => sum + (c.allocated_budget || 0), 0),
    remainingBudget: campaigns.reduce(
      (sum, c: any) => sum + ((c.total_budget || 0) - (c.allocated_budget || 0)),
      0,
    ),
  };

  const budgetAlerts = campaigns.filter((c: any) => {
    if (!c.total_budget || !c.allocated_budget) return false;
    const utilization = (c.allocated_budget / c.total_budget) * 100;
    return utilization >= 80 && utilization < 100;
  }).length;

  const overdueCampaigns = campaigns.filter((c: any) => {
    if (!c.end_date) return false;
    const endDate = new Date(c.end_date);
    const today = new Date();
    const daysUntilEnd = Math.ceil(
      (endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
    );
    return daysUntilEnd <= 7 && daysUntilEnd > 0;
  }).length;

  const alerts = [
    ...(budgetAlerts > 0
      ? [
          {
            type: "warning" as const,
            message: "Budget Alert",
            detail: `${budgetAlerts} campaigns approaching budget limit`,
            count: budgetAlerts,
          },
        ]
      : []),
    ...(overdueCampaigns > 0
      ? [
          {
            type: "info" as const,
            message: "Deadline Reminder",
            detail: `${overdueCampaigns} campaigns ending this week`,
            count: overdueCampaigns,
          },
        ]
      : []),
  ];

  const recentActivities = [
    {
      type: "campaign" as const,
      message: `${calculatedMetrics.activeCampaigns} active campaigns running`,
      time: "1 hour ago",
    },
    {
      type: "performance" as const,
      message: `${completedCampaigns.length} campaigns completed`,
      time: "3 hours ago",
    },
    ...(budgetAlerts > 0
      ? [
          {
            type: "alert" as const,
            message: `${budgetAlerts} campaigns need budget attention`,
            time: "5 hours ago",
          },
        ]
      : []),
    { type: "update" as const, message: "Campaign metrics updated", time: "1 day ago" },
  ];

  const formatCurrency = (amount: number) => {
    if (amount >= 1_000_000_000) return `Rp ${(amount / 1_000_000_000).toFixed(1)}B`;
    if (amount >= 1_000_000) return `Rp ${(amount / 1_000_000).toFixed(1)}M`;
    if (amount >= 1_000) return `Rp ${(amount / 1_000).toFixed(1)}K`;
    return `Rp ${amount.toLocaleString("id-ID")}`;
  };

  return (
    <div className="space-y-4">
      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-brand-blue/20 bg-brand-blue-soft p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-brand-blue-on-soft">Total Budget</p>
              <p className="text-lg font-bold text-brand-blue-deep">
                {formatCurrency(calculatedMetrics.totalBudget)}
              </p>
            </div>
            <DollarSign className="h-4 w-4 text-brand-blue" />
          </div>
        </div>

        <div className="rounded-lg border border-green-200 bg-green-50 p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-green-800">Active Campaigns</p>
              <p className="text-lg font-bold text-green-900">
                {calculatedMetrics.activeCampaigns}
              </p>
            </div>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </div>
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
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
                  alert.type === "warning"
                    ? "border-amber-200 bg-amber-50"
                    : "border-brand-blue/30 bg-brand-blue-soft"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <p
                      className={`truncate text-xs font-medium ${
                        alert.type === "warning" ? "text-amber-900" : "text-brand-blue-deep"
                      }`}
                    >
                      {alert.message}
                    </p>
                    <p
                      className={`mt-0.5 text-xs ${
                        alert.type === "warning" ? "text-amber-700" : "text-brand-blue/85"
                      }`}
                    >
                      {alert.detail}
                    </p>
                  </div>
                  <div
                    className={`ml-2 rounded px-2 py-1 text-xs font-bold ${
                      alert.type === "warning"
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
      )}

      {/* Active campaigns */}
      <div>
        <h4 className="mb-3 flex items-center gap-2 text-xs font-semibold text-brand-blue-deep">
          <Target className="h-3 w-3 text-brand-blue" />
          Active Campaigns
        </h4>
        <div className="space-y-2">
          {activeCampaigns.slice(0, 3).map((campaign: any) => (
            <div
              key={campaign.id}
              className="rounded-lg border border-transparent bg-brand-blue-soft/40 p-2 transition-colors hover:border-brand-blue/20 hover:bg-brand-blue-soft"
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-gray-900">{campaign.name}</p>
                  <p className="truncate text-xs text-gray-500">
                    {campaign.total_budget
                      ? formatCurrency(campaign.total_budget)
                      : "No budget"}
                  </p>
                </div>
                <div className="ml-2 text-right">
                  <div className="text-xs font-medium text-gray-900">
                    {campaign.status || "active"}
                  </div>
                </div>
              </div>
            </div>
          ))}
          {activeCampaigns.length === 0 && (
            <div className="rounded-lg bg-gray-50 p-2">
              <p className="text-center text-xs text-gray-500">No active campaigns</p>
            </div>
          )}
        </div>
      </div>

      {/* Recent activities */}
      <div>
        <h4 className="mb-3 flex items-center gap-2 text-xs font-semibold text-brand-blue-deep">
          <Calendar className="h-3 w-3 text-brand-blue" />
          Recent Activities
        </h4>
        <div className="space-y-2">
          {recentActivities.map((activity, index) => (
            <div
              key={index}
              className="rounded-lg border border-brand-blue/10 bg-brand-blue-soft/30 p-2"
            >
              <div className="flex items-start gap-2">
                <div
                  className={`rounded p-1 ${
                    activity.type === "campaign"
                      ? "bg-brand-blue/20"
                      : activity.type === "update"
                        ? "bg-green-100"
                        : activity.type === "alert"
                          ? "bg-amber-100"
                          : "bg-brand-blue/15"
                  }`}
                >
                  {activity.type === "campaign" ? (
                    <Target className="h-3 w-3 text-brand-blue" />
                  ) : activity.type === "update" ? (
                    <TrendingUp className="h-3 w-3 text-green-600" />
                  ) : activity.type === "alert" ? (
                    <AlertTriangle className="h-3 w-3 text-amber-600" />
                  ) : (
                    <Clock className="h-3 w-3 text-brand-blue-deep" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs leading-tight text-brand-blue-deep">{activity.message}</p>
                  <p className="mt-0.5 text-xs text-brand-blue/70">{activity.time}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Performance summary */}
      <div>
        <h4 className="mb-3 text-xs font-semibold text-brand-blue-deep">Performance Summary</h4>
        <div className="rounded-lg border border-brand-blue/25 bg-gradient-to-r from-brand-blue-soft to-brand-blue/10 p-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-brand-blue/80">Total Campaigns</p>
              <p className="text-sm font-bold text-brand-blue-deep">
                {calculatedMetrics.totalCampaigns}
              </p>
            </div>
            <div>
              <p className="text-xs text-brand-blue/80">Budget Used</p>
              <p className="text-sm font-bold text-brand-blue-deep">
                {calculatedMetrics.totalBudget > 0
                  ? `${(
                      (calculatedMetrics.allocatedBudget / calculatedMetrics.totalBudget) *
                      100
                    ).toFixed(1)}%`
                  : "0%"}
              </p>
            </div>
          </div>
          <div className="mt-2 border-t border-brand-blue/20 pt-2">
            <p className="text-xs text-brand-blue/80">
              <span className="font-medium text-brand-blue">
                {calculatedMetrics.activeCampaigns} active campaigns
              </span>{" "}
              running this month
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KOLCampaignsOverview;

