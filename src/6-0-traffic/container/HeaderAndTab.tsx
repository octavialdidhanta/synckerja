import { useLocation, useNavigate } from "react-router-dom";
import { BarChart3 } from "lucide-react";
import { ModuleTabNavItem } from "@/shared/auth/page-access/ModuleTabNavItem";

const TRAFFIC_ROUTE = "/digital-marketing/traffic";

export function HeaderAndTab() {
  const navigate = useNavigate();
  const location = useLocation();
  const isActive = location.pathname.startsWith(TRAFFIC_ROUTE);

  return (
    <div className="px-1 py-3">
      <div className="mb-3">
        <h1 className="mb-0.5 text-xl font-bold text-gray-900">Web Traffic</h1>
        <p className="text-xs text-gray-600">Monitor traffic & campaign performance</p>
      </div>

      <div className="-mb-3">
        <nav className="flex space-x-6" role="tablist">
          <ModuleTabNavItem
            pagePath={TRAFFIC_ROUTE}
            label="Web Traffic"
            icon={BarChart3}
            isActive={isActive}
            onActivate={() => navigate(TRAFFIC_ROUTE)}
            activeClassName="border-primary text-primary"
            inactiveClassName="border-transparent text-muted-foreground hover:border-border hover:text-foreground"
          />
        </nav>
      </div>
    </div>
  );
}

HeaderAndTab.displayName = "TrafficHeaderAndTab";
