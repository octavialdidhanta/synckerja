import { useLocation, useNavigate } from "react-router-dom";
import { BarChart3, Facebook, LineChart } from "lucide-react";
import { ModuleTabNavItem } from "@/shared/auth/page-access/ModuleTabNavItem";

const TRAFFIC_ROUTE = "/digital-marketing/traffic";
const GOOGLE_ADS_ROUTE = "/digital-marketing/google-ads";
const META_ADS_ROUTE = "/digital-marketing/meta-ads";

export function HeaderAndTab() {
  const navigate = useNavigate();
  const location = useLocation();
  const isTraffic = location.pathname.startsWith(TRAFFIC_ROUTE);
  const isGoogleAds = location.pathname.startsWith(GOOGLE_ADS_ROUTE);
  const isMetaAds = location.pathname.startsWith(META_ADS_ROUTE);

  return (
    <div className="px-1 py-3">
      <div className="mb-3">
        <h1 className="mb-0.5 text-xl font-bold text-gray-900">Digital Marketing</h1>
        <p className="text-xs text-gray-600">Monitor traffic & paid ads performance</p>
      </div>

      <div className="-mb-3">
        <nav className="flex space-x-6" role="tablist">
          <ModuleTabNavItem
            pagePath={TRAFFIC_ROUTE}
            label="Web Traffic"
            icon={BarChart3}
            isActive={isTraffic}
            onActivate={() => navigate(TRAFFIC_ROUTE)}
            activeClassName="border-primary text-primary"
            inactiveClassName="border-transparent text-muted-foreground hover:border-border hover:text-foreground"
          />
          <ModuleTabNavItem
            pagePath={GOOGLE_ADS_ROUTE}
            label="Google Ads"
            icon={LineChart}
            isActive={isGoogleAds}
            onActivate={() => navigate(GOOGLE_ADS_ROUTE)}
            activeClassName="border-primary text-primary"
            inactiveClassName="border-transparent text-muted-foreground hover:border-border hover:text-foreground"
          />
          <ModuleTabNavItem
            pagePath={META_ADS_ROUTE}
            label="Meta Ads"
            icon={Facebook}
            isActive={isMetaAds}
            onActivate={() => navigate(META_ADS_ROUTE)}
            activeClassName="border-primary text-primary"
            inactiveClassName="border-transparent text-muted-foreground hover:border-border hover:text-foreground"
          />
        </nav>
      </div>
    </div>
  );
}

HeaderAndTab.displayName = "TrafficHeaderAndTab";
