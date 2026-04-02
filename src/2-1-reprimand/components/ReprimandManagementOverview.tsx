import { AlertTriangle, BarChart3, Clock, AlertCircle } from "lucide-react";
import { UnifiedAvatar } from "@/shared/components/UnifiedAvatar";
import { ReprimandSidebarFooter } from "./ReprimandSidebarFooter";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

interface ReprimandManagementOverviewProps {
  reprimands: unknown[];
  employees: Array<{ id: string; full_name?: string; profile_photo_url?: string; photo_url?: string }>;
}

function ReprimandManagementOverview({ reprimands, employees }: ReprimandManagementOverviewProps) {
  const { t, dateLocale } = useAppTranslation();
  const list = reprimands as Array<{
    id?: string;
    status?: string;
    created_at?: string;
    severity_level?: string;
    employee_id?: string;
    reprimand_type?: string;
  }>;

  const activityStats = {
    total: list.length,
    active: list.filter((r) => r.status === "active").length,
    thisMonth: list.filter((r) => {
      const raw = r.created_at;
      if (raw == null || raw === "") return false;
      const reprimandDate = new Date(raw);
      if (Number.isNaN(reprimandDate.getTime())) return false;
      const now = new Date();
      return reprimandDate.getMonth() === now.getMonth() && reprimandDate.getFullYear() === now.getFullYear();
    }).length,
  };

  const severityStats = list.reduce(
    (acc, r) => {
      const severity = r.severity_level || "unknown";
      acc[severity] = (acc[severity] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const recentActivities = [...list]
    .filter((r) => r.created_at != null && r.created_at !== "")
    .sort((a, b) => {
      const ta = new Date(a.created_at!).getTime();
      const tb = new Date(b.created_at!).getTime();
      return (Number.isNaN(tb) ? 0 : tb) - (Number.isNaN(ta) ? 0 : ta);
    })
    .slice(0, 20);

  const formatDate = (dateString: string | null | undefined) => {
    if (dateString == null || dateString === "") return "—";
    const activityDate = new Date(dateString);
    if (Number.isNaN(activityDate.getTime())) return "—";
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - activityDate.getTime()) / (1000 * 60 * 60));
    if (diffInHours < 1) return t("reprimands.overviewTime.justNow", "Just now");
    if (diffInHours < 24)
      return t("reprimands.overviewTime.hoursAgo", "{{hours}}h ago", { hours: diffInHours });
    if (diffInHours < 48) return t("reprimands.overviewTime.yesterday", "Yesterday");
    return activityDate.toLocaleDateString(dateLocale, { month: "short", day: "numeric" });
  };

  const formatReprimandType = (type: string) => {
    return type?.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()) ?? t("reprimands.overviewTime.unknownType", "Unknown");
  };

  return (
    <div className="flex h-full flex-col rounded-lg border border-border bg-card shadow-sm">
      <div className="flex-shrink-0 border-b border-border px-4 py-1.5">
        <h3 className="text-sm font-semibold text-foreground">
          {t("reprimands.overview.title", "Reprimand Overview")}
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {t("reprimands.overview.subtitle", "Disciplinary action statistics and insights")}
        </p>
      </div>

      <div className="min-h-0 flex-1">
        <div className="h-full space-y-4 p-4">
          <div className="grid grid-cols-1 gap-3">
            <div className="rounded-lg bg-red-50 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-red-800">
                    {t("reprimands.overview.totalReprimands", "Total Reprimands")}
                  </p>
                  <p className="text-lg font-bold text-red-900">{activityStats.total}</p>
                </div>
                <AlertTriangle className="h-4 w-4 text-red-600" />
              </div>
            </div>

            <div className="rounded-lg bg-orange-50 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-orange-800">
                    {t("reprimands.overview.activeWarnings", "Active Warnings")}
                  </p>
                  <p className="text-lg font-bold text-orange-900">{activityStats.active}</p>
                </div>
                <AlertCircle className="h-4 w-4 text-orange-600" />
              </div>
            </div>

            <div className="rounded-lg border border-brand-blue/30 bg-brand-blue/10 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-brand-blue">
                    {t("reprimands.overview.thisMonth", "This Month")}
                  </p>
                  <p className="text-lg font-bold text-brand-blue">{activityStats.thisMonth}</p>
                </div>
                <Clock className="h-4 w-4 text-brand-blue" />
              </div>
            </div>
          </div>

          <div>
            <h4 className="mb-3 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <BarChart3 className="h-3 w-3" />
              {t("reprimands.overview.severityDistribution", "Severity Distribution")}
            </h4>
            <div className="space-y-2">
              {(["critical", "high", "medium", "low"] as const).map((severity) => {
                const count = severityStats[severity] || 0;
                const colors = {
                  critical: "bg-red-500",
                  high: "bg-orange-500",
                  medium: "bg-yellow-500",
                  low: "bg-brand-blue",
                };

                return (
                  <div key={severity} className="rounded-lg border border-border bg-muted/40 p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div className={`h-2 w-2 rounded-full ${colors[severity]}`} />
                        <span className="text-xs font-medium capitalize text-foreground">{severity}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{count}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <h4 className="mb-3 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <Clock className="h-3 w-3" />
              {t("reprimands.overview.recentActivity", "Recent Activity")}
            </h4>
            <div className="space-y-2">
              {recentActivities.length > 0 ? (
                recentActivities.slice(0, 3).map((activity) => {
                  const employee = employees.find((e) => e.id === activity.employee_id);

                  return (
                    <div key={activity.id ?? `${activity.employee_id}-${activity.created_at}`} className="rounded-lg border border-border bg-muted/40 p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                          <UnifiedAvatar
                            photoUrl={employee?.profile_photo_url || employee?.photo_url}
                            name={employee?.full_name || "?"}
                            size="sm"
                            className="shrink-0"
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-foreground">
                              {employee?.full_name ||
                                t("reprimands.overview.unknownEmployee", "Unknown Employee")}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatReprimandType(activity.reprimand_type ?? "")} • {activity.severity_level}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">{formatDate(activity.created_at)}</p>
                          <div
                            className={`mt-1 h-2 w-2 rounded-full ${
                              activity.status === "active"
                                ? "bg-red-500"
                                : activity.status === "resolved"
                                  ? "bg-brand-blue"
                                  : "bg-yellow-500"
                            }`}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-4 text-center">
                  <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
                  <p className="text-xs text-muted-foreground">
                    {t("reprimands.overview.noRecent", "No recent activity")}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <ReprimandSidebarFooter
        totalReprimands={activityStats.total}
        activeReprimands={activityStats.active}
        thisMonthReprimands={activityStats.thisMonth}
      />
    </div>
  );
}

export default ReprimandManagementOverview;
