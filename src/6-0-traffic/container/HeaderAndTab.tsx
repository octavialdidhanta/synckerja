import { useLocation, useNavigate } from "react-router-dom";
import { BarChart3, FileText } from "lucide-react";
import { ModuleTabNavItem } from "@/shared/auth/page-access/ModuleTabNavItem";
import { GoogleAdsTabIcon } from "@/6-0-traffic/container/GoogleAdsTabIcon";
import { MetaTabIcon } from "@/6-0-traffic/container/MetaTabIcon";
import { TikTokTabIcon } from "@/6-0-traffic/container/TikTokTabIcon";

const TRAFFIC_ROUTE = "/digital-marketing/traffic";
const GOOGLE_ADS_ROUTE = "/digital-marketing/google-ads";
const META_ADS_ROUTE = "/digital-marketing/meta-ads";
const TIKTOK_ADS_ROUTE = "/digital-marketing/tiktok-ads";
const REPORT_ROUTE = "/digital-marketing/report";

export function HeaderAndTab() {
  const navigate = useNavigate();
  const location = useLocation();
  const isTraffic = location.pathname.startsWith(TRAFFIC_ROUTE);
  const isGoogleAds = location.pathname.startsWith(GOOGLE_ADS_ROUTE);
  const isMetaAds = location.pathname.startsWith(META_ADS_ROUTE);
  const isTikTokAds = location.pathname.startsWith(TIKTOK_ADS_ROUTE);
  const isReport = location.pathname.startsWith(REPORT_ROUTE);

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
            icon={GoogleAdsTabIcon}
            isActive={isGoogleAds}
            onActivate={() => navigate(GOOGLE_ADS_ROUTE)}
            activeClassName="border-primary text-primary"
            inactiveClassName="border-transparent text-muted-foreground hover:border-border hover:text-foreground"
          />
          <ModuleTabNavItem
            pagePath={META_ADS_ROUTE}
            label="Meta Ads"
            icon={MetaTabIcon}
            isActive={isMetaAds}
            onActivate={() => navigate(META_ADS_ROUTE)}
            activeClassName="border-primary text-primary"
            inactiveClassName="border-transparent text-muted-foreground hover:border-border hover:text-foreground"
          />
          <ModuleTabNavItem
            pagePath={TIKTOK_ADS_ROUTE}
            label="TikTok Ads"
            icon={TikTokTabIcon}
            isActive={isTikTokAds}
            onActivate={() => navigate(TIKTOK_ADS_ROUTE)}
            activeClassName="border-primary text-primary"
            inactiveClassName="border-transparent text-muted-foreground hover:border-border hover:text-foreground"
          />
          <ModuleTabNavItem
            pagePath={REPORT_ROUTE}
            label="Report"
            icon={FileText}
            isActive={isReport}
            onActivate={() => navigate(REPORT_ROUTE)}
            activeClassName="border-primary text-primary"
            inactiveClassName="border-transparent text-muted-foreground hover:border-border hover:text-foreground"
          />
        </nav>
      </div>
    </div>
  );
}

HeaderAndTab.displayName = "TrafficHeaderAndTab";
