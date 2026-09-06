import { Home, Calendar, BarChart3, User, MapPin, MessageCircle, UserPlus, FileBarChart } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import {
  CONSULTANT_LEADS_MANAGEMENT_PATH,
  CONSULTANT_LIVECHAT_PATH,
} from "@/mobile/4-leads-management/shared/consultantCrmNavPaths";
import { useFilteredNavByPageAccess } from "@/shared/auth/page-access/useFilteredNavByPageAccess";
import { MobileNavTabButton } from "@/shared/auth/page-access/MobileNavTabButton";
import {
  MOBILE_PAGE_PATH,
  mobileFooterPagePathForRoute,
} from "@/shared/auth/page-access/mobileRoutePagePaths";

const navItems = [
  { icon: Home, label: "Home", path: "/" },
  { icon: Calendar, label: "Schedule", path: "/schedule" },
  { icon: MapPin, label: "Client Visit", path: "/client-visit" },
  { icon: BarChart3, label: "Reports", path: "/reports" },
  { icon: User, label: "Profile", path: "/profile" },
];

interface NavigationFooterProps {
  /** Optional class; default `safe-area-bottom-lower` (plugin inset). Legacy env classes still accepted. */
  className?: string;
  /** When true, render only the footer bar (no nav icons). Use e.g. on livechat to reserve space for custom nav. */
  hideItems?: boolean;
}

export const NavigationFooter = ({ className, hideItems }: NavigationFooterProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useAppTranslation();
  const { filterNavItems } = useFilteredNavByPageAccess();
  const visibleNavItems = filterNavItems(navItems);

  const handleNavClick = (path: string, search?: string) => {
    navigate(search ? { pathname: path, search } : path);
  };

  const isLiveChatPage = location.pathname.includes(CONSULTANT_LIVECHAT_PATH);
  const isLeadsManagementPath = location.pathname.includes(CONSULTANT_LEADS_MANAGEMENT_PATH);
  const viewParam = new URLSearchParams(location.search).get("view");
  const isReportView = isLeadsManagementPath && viewParam === "report";
  const isLeadsListView = isLeadsManagementPath && !isReportView;
  const showThreeItemBar = hideItems && (isLiveChatPage || isLeadsManagementPath);

  return (
    <nav
      className={`mobile-app-bottom-nav fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-card ${className ?? "safe-area-bottom-lower"}`.trim()}
    >
      <div
        className={`mx-auto grid max-w-md ${showThreeItemBar ? "min-h-[52px] grid-cols-3" : hideItems ? "min-h-[52px] grid-cols-1 place-items-center" : ""}`.trim()}
        style={
          !showThreeItemBar && !hideItems
            ? {
                gridTemplateColumns: `repeat(${Math.max(visibleNavItems.length, 1)}, minmax(0, 1fr))`,
              }
            : undefined
        }
      >
        {showThreeItemBar ? (
          <>
            <MobileNavTabButton
              pagePath={MOBILE_PAGE_PATH.omnichannelLivechat}
              label={t("sidebar.operations.livechat.title", "Live Chat")}
              icon={MessageCircle}
              isActive={isLiveChatPage}
              onActivate={() => !isLiveChatPage && handleNavClick(CONSULTANT_LIVECHAT_PATH)}
              labelClassName="text-xs font-medium"
            />
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
              isActive={isReportView}
              onActivate={() =>
                !isReportView && handleNavClick(CONSULTANT_LEADS_MANAGEMENT_PATH, "?view=report")
              }
              labelClassName="text-xs font-medium"
            />
          </>
        ) : !hideItems ? (
          visibleNavItems.map(({ icon: Icon, label, path }) => {
            const isActive = location.pathname === path;
            const pagePath = mobileFooterPagePathForRoute(path);
            if (!pagePath) {
              return (
                <button
                  key={path}
                  type="button"
                  onClick={() => handleNavClick(path)}
                  className={`flex flex-col items-center py-2 px-1 transition-colors ${
                    isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="h-5 w-5 mb-1" />
                  <span className="text-xs font-medium">{label}</span>
                </button>
              );
            }
            return (
              <MobileNavTabButton
                key={path}
                pagePath={pagePath}
                label={label}
                icon={Icon}
                isActive={isActive}
                onActivate={() => handleNavClick(path)}
                labelClassName="text-xs font-medium"
              />
            );
          })
        ) : null}
      </div>
    </nav>
  );
};
