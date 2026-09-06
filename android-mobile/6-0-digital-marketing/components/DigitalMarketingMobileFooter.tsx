import { BarChart3, FileBarChart } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { MobileNavTabButton } from "@/shared/auth/page-access/MobileNavTabButton";
import { MOBILE_PAGE_PATH } from "@/shared/auth/page-access/mobileRoutePagePaths";
import { GoogleAdsTabIcon } from "@/6-0-traffic/container/GoogleAdsTabIcon";
import { MetaTabIcon } from "@/6-0-traffic/container/MetaTabIcon";
import { TikTokTabIcon } from "@/6-0-traffic/container/TikTokTabIcon";

const WEB_TRAFFIC_PATH = "/digital-marketing/traffic";
const GOOGLE_ADS_PATH = "/digital-marketing/google-ads";
const META_ADS_PATH = "/digital-marketing/meta-ads";
const TIKTOK_ADS_PATH = "/digital-marketing/tiktok-ads";
const REPORT_PATH = "/digital-marketing/report";

interface DigitalMarketingMobileFooterProps {
  /** Optional class; default `safe-area-padding-bottom-capped`. */
  className?: string;
}

export function DigitalMarketingMobileFooter({ className }: DigitalMarketingMobileFooterProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useAppTranslation();

  const isTraffic = location.pathname === WEB_TRAFFIC_PATH;
  const isGoogleAds =
    location.pathname === GOOGLE_ADS_PATH ||
    location.pathname.startsWith(`${GOOGLE_ADS_PATH}/`);
  const isMetaAds =
    location.pathname === META_ADS_PATH ||
    location.pathname.startsWith(`${META_ADS_PATH}/`);
  const isTikTokAds =
    location.pathname === TIKTOK_ADS_PATH ||
    location.pathname.startsWith(`${TIKTOK_ADS_PATH}/`);
  const isReport =
    location.pathname === REPORT_PATH ||
    location.pathname.startsWith(`${REPORT_PATH}/`);

  return (
    <nav className="mobile-app-bottom-nav fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-card safe-area-bottom-lower">
      <div
        className={`mx-auto grid max-w-md min-h-[52px] grid-cols-5 place-items-center ${
          className ?? ""
        }`.trim()}
      >
        <MobileNavTabButton
          pagePath={MOBILE_PAGE_PATH.digitalMarketingTraffic}
          label={t("sidebar.digitalMarketing.webTraffic.mobileFooterTitle", "Web Traffic")}
          icon={BarChart3}
          isActive={isTraffic}
          onActivate={() => !isTraffic && navigate(WEB_TRAFFIC_PATH)}
          labelClassName="text-[9px] font-medium leading-tight"
        />
        <MobileNavTabButton
          pagePath={MOBILE_PAGE_PATH.digitalMarketingGoogleAds}
          label={t("sidebar.digitalMarketing.googleAds.title", "Google Ads")}
          icon={GoogleAdsTabIcon}
          isActive={isGoogleAds}
          onActivate={() => !isGoogleAds && navigate(GOOGLE_ADS_PATH)}
          labelClassName="text-[9px] font-medium leading-tight"
        />
        <MobileNavTabButton
          pagePath={MOBILE_PAGE_PATH.digitalMarketingMetaAds}
          label={t("sidebar.digitalMarketing.metaAds.title", "Meta Ads")}
          icon={MetaTabIcon}
          isActive={isMetaAds}
          onActivate={() => !isMetaAds && navigate(META_ADS_PATH)}
          labelClassName="text-[9px] font-medium leading-tight"
        />
        <MobileNavTabButton
          pagePath={MOBILE_PAGE_PATH.digitalMarketingTikTokAds}
          label={t("sidebar.digitalMarketing.tiktokAds.title", "TikTok Ads")}
          icon={TikTokTabIcon}
          isActive={isTikTokAds}
          onActivate={() => !isTikTokAds && navigate(TIKTOK_ADS_PATH)}
          labelClassName="text-[9px] font-medium leading-tight"
        />
        <MobileNavTabButton
          pagePath={MOBILE_PAGE_PATH.digitalMarketingReport}
          label={t("sidebar.digitalMarketing.report.title", "Report")}
          icon={FileBarChart}
          isActive={isReport}
          onActivate={() => !isReport && navigate(REPORT_PATH)}
          labelClassName="text-[9px] font-medium leading-tight"
        />
      </div>
    </nav>
  );
}
