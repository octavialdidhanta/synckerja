import { BarChart3 } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { MobileNavTabButton } from "@/shared/auth/page-access/MobileNavTabButton";
import { MOBILE_PAGE_PATH } from "@/shared/auth/page-access/mobileRoutePagePaths";

const WEB_TRAFFIC_PATH = "/digital-marketing/traffic";

interface WebTrafficNavigationFooterProps {
  /** Optional class; default `safe-area-padding-bottom-capped`. */
  className?: string;
}

export function WebTrafficNavigationFooter({ className }: WebTrafficNavigationFooterProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useAppTranslation();

  const isActive = location.pathname === WEB_TRAFFIC_PATH;
  const label = t("traffic.page.title", "Web Traffic");

  return (
    <nav className="mobile-app-bottom-nav fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-card">
      <div
        className={`mx-auto grid max-w-md min-h-[52px] grid-cols-1 place-items-center ${
          className ?? "safe-area-padding-bottom-capped"
        }`.trim()}
      >
        <MobileNavTabButton
          pagePath={MOBILE_PAGE_PATH.digitalMarketingTraffic}
          label={label}
          icon={BarChart3}
          isActive={isActive}
          onActivate={() => !isActive && navigate(WEB_TRAFFIC_PATH)}
          labelClassName="text-xs font-medium"
        />
      </div>
    </nav>
  );
}
