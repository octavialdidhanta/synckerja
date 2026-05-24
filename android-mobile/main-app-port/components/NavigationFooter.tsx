import { Home, Calendar, BarChart3, User, MapPin, MessageCircle, UserPlus, FileBarChart } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import {
  CONSULTANT_LEADS_MANAGEMENT_PATH,
  CONSULTANT_LIVECHAT_PATH,
} from "@/mobile/4-leads-management/shared/consultantCrmNavPaths";
import { useFilteredNavByPageAccess } from "@/shared/auth/page-access/useFilteredNavByPageAccess";

const navItems = [
  { icon: Home, label: "Home", path: "/" },
  { icon: Calendar, label: "Schedule", path: "/schedule" },
  { icon: MapPin, label: "Client Visit", path: "/client-visit" },
  { icon: BarChart3, label: "Reports", path: "/reports" },
  { icon: User, label: "Profile", path: "/profile" }
];

interface NavigationFooterProps {
  /** Optional class; default `safe-area-padding-bottom-capped`. Legacy: `safe-area-bottom-lower`, `safe-area-padding-bottom`. */
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
      className={`mobile-app-bottom-nav fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-card ${className ?? "safe-area-padding-bottom-capped"}`.trim()}
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
            <button
              type="button"
              onClick={() => !isLiveChatPage && handleNavClick(CONSULTANT_LIVECHAT_PATH)}
              className={`flex flex-col items-center justify-center py-2 transition-colors ${
                isLiveChatPage ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
              aria-current={isLiveChatPage ? "page" : undefined}
            >
              <MessageCircle className="h-5 w-5 mb-1" aria-hidden />
              <span className="text-xs font-medium">{t("sidebar.operations.livechat.title", "Live Chat")}</span>
            </button>
            <button
              type="button"
              onClick={() => !isLeadsListView && handleNavClick(CONSULTANT_LEADS_MANAGEMENT_PATH)}
              className={`flex flex-col items-center justify-center py-2 transition-colors ${
                isLeadsListView ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
              aria-current={isLeadsListView ? "page" : undefined}
            >
              <UserPlus className="h-5 w-5 mb-1" aria-hidden />
              <span className="text-xs font-medium">{t("sidebar.operations.leadsManagement.title", "Leads")}</span>
            </button>
            <button
              type="button"
              onClick={() =>
                !isReportView && handleNavClick(CONSULTANT_LEADS_MANAGEMENT_PATH, "?view=report")
              }
              className={`flex flex-col items-center justify-center py-2 transition-colors ${
                isReportView ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
              aria-current={isReportView ? "page" : undefined}
            >
              <FileBarChart className="h-5 w-5 mb-1" aria-hidden />
              <span className="text-xs font-medium">{t("sidebar.operations.leadsManagement.report", "Report")}</span>
            </button>
          </>
        ) : !hideItems ? (
          visibleNavItems.map(({ icon: Icon, label, path }) => {
            const isActive = location.pathname === path;
            return (
              <button
                key={path}
                onClick={() => handleNavClick(path)}
                className={`flex flex-col items-center py-2 px-1 transition-colors ${
                  isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-5 w-5 mb-1" />
                <span className="text-xs font-medium">{label}</span>
              </button>
            );
          })
        ) : null}
      </div>
    </nav>
  );
};