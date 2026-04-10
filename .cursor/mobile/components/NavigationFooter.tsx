import { Home, Calendar, BarChart3, User, MapPin, MessageCircle, UserPlus, FileBarChart } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { usePrefetchHomeData } from "@/hooks/useParallelHomeData";
import { useIsMobile } from "@/mobile/hooks/use-mobile";
import { logger } from "@/config/logger";
import { useAppTranslation } from "@/features/share/i18n/useAppTranslation";

const navItems = [
  { icon: Home, label: "Home", path: "/" },
  { icon: Calendar, label: "Schedule", path: "/schedule" },
  { icon: MapPin, label: "Client Visit", path: "/client-visit" },
  { icon: BarChart3, label: "Reports", path: "/reports" },
  { icon: User, label: "Profile", path: "/profile" }
];

interface NavigationFooterProps {
  /** Optional class to e.g. reduce bottom padding (safe-area-bottom-lower) on specific pages */
  className?: string;
  /** When true, render only the footer bar (no nav icons). Use e.g. on livechat to reserve space for custom nav. */
  hideItems?: boolean;
}

export const NavigationFooter = ({ className, hideItems }: NavigationFooterProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const prefetchHomeData = usePrefetchHomeData();
  const { t } = useAppTranslation();

  const handleNavClick = (path: string, search?: string) => {
    if (path === "/" && !isMobile) {
      prefetchHomeData().catch((err) => {
        logger.warn("Prefetch home failed", err);
      });
    }
    navigate(search ? { pathname: path, search } : path);
  };

  const isLiveChatPage = location.pathname.includes("/operations/consultant/all/livechat");
  const isLeadsManagementPath = location.pathname.includes("/operations/consultant/leads-management");
  const viewParam = new URLSearchParams(location.search).get("view");
  const isReportView = isLeadsManagementPath && viewParam === "report";
  const isLeadsListView = isLeadsManagementPath && !isReportView;
  const showThreeItemBar = hideItems && (isLiveChatPage || isLeadsManagementPath);

  return (
    <nav
      className="fixed left-0 right-0 bottom-0 bg-card border-t border-border z-30"
    >
      <div className={`grid max-w-md mx-auto ${showThreeItemBar ? "min-h-[52px] grid-cols-3" : hideItems ? "min-h-[52px] grid-cols-1 place-items-center" : "grid-cols-5"} ${className ?? "safe-area-padding-bottom"}`.trim()}>
        {showThreeItemBar ? (
          <>
            <button
              type="button"
              onClick={() => !isLiveChatPage && handleNavClick("/operations/consultant/all/livechat")}
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
              onClick={() => !isLeadsListView && handleNavClick("/operations/consultant/leads-management")}
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
              onClick={() => !isReportView && handleNavClick("/operations/consultant/leads-management", "?view=report")}
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
          navItems.map(({ icon: Icon, label, path }) => {
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