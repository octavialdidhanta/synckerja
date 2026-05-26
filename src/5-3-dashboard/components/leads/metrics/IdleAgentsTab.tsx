import { User2, Users } from "lucide-react";
import { Link } from "react-router-dom";
import type { NewLead } from "@/shared/types/leads";
import type { OrganizationOmnichannelStaffRow } from "@/shared/hooks/useOrganizationOmnichannelStaff";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useIdleAgentRows } from "@/5-3-dashboard/hooks/useIdleAgentRows";
import {
  formatIdleDurationMs,
  type IdleAgentPresenceStatus,
} from "@/5-3-dashboard/components/leads/metrics/idleAgentsUtils";
import { omnichannelSettingsPath } from "@/5-3-dashboard/omnichannel-settings/constants/omnichannelSettingsSections";
import { cn } from "@/shared/lib/utils";

type IdleAgentsTabProps = {
  filteredLeads: NewLead[];
  allLeads: NewLead[];
  omnichannelRoster: OrganizationOmnichannelStaffRow[];
  rosterLoading?: boolean;
  denserSections?: boolean;
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

function statusBadgeClass(status: IdleAgentPresenceStatus): string {
  if (status === "idle") return "bg-amber-100 text-amber-800 border-amber-200";
  if (status === "online") return "bg-emerald-100 text-emerald-800 border-emerald-200";
  return "bg-muted text-muted-foreground border-border";
}

export function IdleAgentsTab({
  filteredLeads,
  allLeads,
  omnichannelRoster,
  rosterLoading = false,
  denserSections = false,
}: IdleAgentsTabProps) {
  const { t } = useAppTranslation();
  const { rows, summary, pending } = useIdleAgentRows({
    filteredLeads,
    allLeads,
    roster: omnichannelRoster,
    rosterLoading,
  });

  const sectionSpacingClass = denserSections ? "space-y-1 mt-1" : "space-y-3 mt-4";
  const sectionCardClass = (base: string) => {
    let result = base.replace("border-none", "border border-border");
    if (denserSections) {
      result = result.replace(/shadow-sm|shadow/g, "shadow-none");
    }
    return result;
  };
  const cardShellClass = (gradient: string) =>
    cn(sectionCardClass(`border-none shadow-sm bg-gradient-to-r ${gradient}`), "w-full min-w-0");
  const headerClass = denserSections ? "space-y-1.5 p-4 pb-2" : "pb-2";
  const contentClass = denserSections ? "p-4 pt-0" : undefined;

  const labelForRole = (role: string) => {
    if (role === "admin") return t("omnichannel.settings.userManagement.roleAdminOmnichannel", "Admin (omnichannel)");
    return t(`omnichannel.settings.userManagement.role.${role}`, role);
  };

  const labelForStatus = (status: IdleAgentPresenceStatus) => {
    if (status === "idle") return t("leadsManagement.reportSummary.idleAgents.statusIdle", "Idle");
    if (status === "online") return t("omnichannel.settings.userManagement.statusOnline", "Online");
    return t("omnichannel.settings.userManagement.statusOffline", "Offline");
  };

  if (pending && rows.length === 0) {
    return (
      <div className={cn(sectionSpacingClass, "min-w-0")} aria-busy="true" aria-label={t("leadsManagement.reportSummary.idleAgents.loading", "Loading idle agents")}>
        <Skeleton className="h-20 w-full rounded-lg" />
        <Skeleton className="h-16 w-full rounded-lg" />
        <Skeleton className="h-16 w-full rounded-lg" />
      </div>
    );
  }

  if (omnichannelRoster.length === 0) {
    return (
      <div className={sectionSpacingClass}>
        <Card className={sectionCardClass("border border-border shadow-sm")}>
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            <p>{t("leadsManagement.reportSummary.idleAgents.emptyRoster", "No omnichannel staff on the roster yet.")}</p>
            <Link
              to={omnichannelSettingsPath("user-management")}
              className="mt-2 inline-block text-brand-blue hover:underline"
            >
              {t("leadsManagement.reportSummary.idleAgents.openUserManagement", "Open User Management")}
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={cn(sectionSpacingClass, "min-w-0 max-w-full")}>
      <Card className={cardShellClass("from-slate-50 to-gray-50")}>
        <CardHeader className={headerClass}>
          <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <Users className="h-4 w-4 text-slate-600" />
            {t("leadsManagement.reportSummary.idleAgents.summaryTitle", "Availability summary")}
          </CardTitle>
        </CardHeader>
        <CardContent className={cn(contentClass, "min-w-0")}>
          <div className="grid min-w-0 w-full grid-cols-3 gap-2 text-center text-xs">
            <div className="min-w-0 rounded-lg border border-amber-200 bg-amber-50/80 p-2">
              <div className="text-lg font-bold text-amber-800">{summary.idle}</div>
              <div className="truncate text-amber-900/80">{t("leadsManagement.reportSummary.idleAgents.statusIdle", "Idle")}</div>
            </div>
            <div className="min-w-0 rounded-lg border border-emerald-200 bg-emerald-50/80 p-2">
              <div className="text-lg font-bold text-emerald-800">{summary.online}</div>
              <div className="truncate text-emerald-900/80">{t("leadsManagement.reportSummary.idleAgents.busyLabel", "Online (busy)")}</div>
            </div>
            <div className="min-w-0 rounded-lg border border-border bg-muted/50 p-2">
              <div className="text-lg font-bold text-slate-700">{summary.offline}</div>
              <div className="text-muted-foreground">{t("omnichannel.settings.userManagement.statusOffline", "Offline")}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className={cardShellClass("from-brand-blue-soft to-brand-red/5")}>
        <CardHeader className={headerClass}>
          <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <User2 className="h-4 w-4 text-brand-blue" />
            {t("leadsManagement.reportSummary.idleAgents.rosterTitle", "Roster")} ({summary.total})
          </CardTitle>
        </CardHeader>
        <CardContent className={cn(contentClass, "min-w-0 space-y-2")}>
          {rows.map((row) => (
            <div
              key={row.rosterId}
              className="flex items-start gap-2 rounded-lg border border-border bg-white/70 p-2.5"
            >
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700"
                aria-hidden
              >
                {initials(row.fullName)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="truncate text-sm font-medium text-slate-800">{row.fullName}</span>
                  <Badge variant="outline" className="text-[10px] font-normal">
                    {labelForRole(row.role)}
                  </Badge>
                  <Badge variant="outline" className={cn("text-[10px] font-medium", statusBadgeClass(row.presenceStatus))}>
                    {labelForStatus(row.presenceStatus)}
                  </Badge>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                  <span>
                    {t("leadsManagement.reportSummary.idleAgents.activeChats", "Active chats")}:{" "}
                    <span className="font-medium text-slate-700">{row.activeChatCount}</span>
                  </span>
                  <span>
                    {t("leadsManagement.reportSummary.idleAgents.idleFor", "Idle for")}:{" "}
                    <span className="font-medium text-slate-700">
                      {row.idleSinceMs != null
                        ? formatIdleDurationMs(row.idleSinceMs)
                        : "—"}
                    </span>
                  </span>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
