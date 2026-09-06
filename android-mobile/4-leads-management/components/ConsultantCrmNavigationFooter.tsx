import { Clock, FileBarChart, MessageCircle, UserPlus } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { MobileNavTabButton } from "@/shared/auth/page-access/MobileNavTabButton";
import { MOBILE_PAGE_PATH } from "@/shared/auth/page-access/mobileRoutePagePaths";
import { useLeadsReportIdleAccess } from "@/5-3-dashboard/leads-report";
import { cn } from "@/shared/lib/utils";
import {
  CONSULTANT_LEADS_MANAGEMENT_PATH,
  CONSULTANT_LIVECHAT_PATH,
  buildLeadsIdleAgentsSearch,
  buildLeadsReportSearch,
} from "@/mobile/4-leads-management/shared/consultantCrmNavPaths";
import { LEADS_REPORT_IDLE_TAB_ID, LEADS_REPORT_TAB_PARAM, LEADS_REPORT_VIEW_PARAM } from "@/5-3-dashboard/leads-report";

type ConsultantCrmNavigationFooterProps = {
  className?: string;
  /**
   * `true` (default): `fixed` to viewport bottom (same as other Office mobile tab bars).
   * Scroll content clears it via `content-padding-above-nav-*` (+ `--footer-bottom-inset` on Android).
   * `false`: in-flow `shrink-0` only if a rare layout cannot use content padding.
   */
  docked?: boolean;
};

export function ConsultantCrmNavigationFooter({
  className,
  docked = true,
}: ConsultantCrmNavigationFooterProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useAppTranslation();
  const { canViewIdleAgents, gatePending } = useLeadsReportIdleAccess();
  const showIdleAgents = canViewIdleAgents && !gatePending;

  const searchParams = new URLSearchParams(location.search);
  const viewParam = searchParams.get("view");
  const reportTab = searchParams.get(LEADS_REPORT_TAB_PARAM);

  const isLiveChatPage = location.pathname.includes(CONSULTANT_LIVECHAT_PATH);
  const isLeadsManagementPath = location.pathname.includes(CONSULTANT_LEADS_MANAGEMENT_PATH);
  const isReportView = isLeadsManagementPath && viewParam === LEADS_REPORT_VIEW_PARAM;
  const isIdleAgentsView = isReportView && reportTab === LEADS_REPORT_IDLE_TAB_ID;
  const isMainReportView = isReportView && !isIdleAgentsView;
  const isLeadsListView = isLeadsManagementPath && !isReportView;

  const handleNavClick = (path: string, search?: string) => {
    navigate(search ? { pathname: path, search } : path);
  };

  return (
    <nav
      className={cn(
        "mobile-app-bottom-nav z-30 border-t border-border bg-card",
        docked ? "fixed bottom-0 left-0 right-0" : "relative shrink-0",
        className ?? "safe-area-bottom-lower",
      )}
    >
      <div
        className={cn(
          "mx-auto grid min-h-[52px] max-w-md",
          showIdleAgents ? "grid-cols-4" : "grid-cols-3",
        )}
      >
        <MobileNavTabButton
          pagePath={MOBILE_PAGE_PATH.omnichannelLivechat}
          label={t("sidebar.operations.livechat.title", "Live Chat")}
          icon={MessageCircle}
          isActive={isLiveChatPage}
          onActivate={() => !isLiveChatPage && handleNavClick(CONSULTANT_LIVECHAT_PATH)}
          labelClassName="text-xs font-medium"
        />
        {showIdleAgents ? (
          <MobileNavTabButton
            pagePath={MOBILE_PAGE_PATH.omnichannelLeads}
            label={t("leadsManagement.footer.idleAgents", "Idle Agents")}
            icon={Clock}
            isActive={isIdleAgentsView}
            onActivate={() =>
              !isIdleAgentsView &&
              handleNavClick(CONSULTANT_LEADS_MANAGEMENT_PATH, buildLeadsIdleAgentsSearch())
            }
            labelClassName="text-xs font-medium"
          />
        ) : null}
        <MobileNavTabButton
          pagePath={MOBILE_PAGE_PATH.omnichannelLeads}
          label={t("sidebar.operations.leadsManagement.title", "Leads")}
          icon={UserPlus}
          isActive={isLeadsListView}
          onActivate={() => !isLeadsListView && handleNavClick(CONSULTANT_LEADS_MANAGEMENT_PATH)}
          labelClassName="text-xs font-medium"
        />
        <MobileNavTabButton
          pagePath={MOBILE_PAGE_PATH.omnichannelLeads}
          label={t("sidebar.operations.leadsManagement.report", "Report")}
          icon={FileBarChart}
          isActive={isMainReportView}
          onActivate={() =>
            !isMainReportView &&
            handleNavClick(CONSULTANT_LEADS_MANAGEMENT_PATH, buildLeadsReportSearch())
          }
          labelClassName="text-xs font-medium"
        />
      </div>
    </nav>
  );
}
