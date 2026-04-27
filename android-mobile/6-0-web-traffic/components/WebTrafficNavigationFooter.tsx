import { BarChart3 } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

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

  return (
    <nav className="mobile-app-bottom-nav fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-card">
      <div
        className={`mx-auto grid max-w-md min-h-[52px] grid-cols-1 place-items-center ${
          className ?? "safe-area-padding-bottom-capped"
        }`.trim()}
      >
        <button
          type="button"
          onClick={() => !isActive && navigate(WEB_TRAFFIC_PATH)}
          className={`flex flex-col items-center justify-center py-2 px-1 transition-colors ${
            isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
          }`}
          aria-current={isActive ? "page" : undefined}
        >
          <BarChart3 className="mb-1 h-5 w-5" aria-hidden />
          <span className="text-xs font-medium">{t("traffic.page.title", "Web Traffic")}</span>
        </button>
      </div>
    </nav>
  );
}

