import { LayoutDashboard, Package, Settings } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ModuleTabNavItem } from "@/shared/auth/page-access/ModuleTabNavItem";
import {
  TIKTOK_SHOP_BASE_PATH,
  TIKTOK_SHOP_DASHBOARD_PATH,
  TIKTOK_SHOP_PRODUCTS_PATH,
  TIKTOK_SHOP_SETTINGS_PATH,
} from "@/tiktok-shop/settings/tiktokShopSettingsPaths";

const tabActive = "border-primary text-primary";
const tabInactive =
  "border-transparent text-muted-foreground hover:border-border hover:text-foreground";

export function TikTokShopHeaderAndTab() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const isSettings = location.pathname.startsWith(TIKTOK_SHOP_SETTINGS_PATH);
  const isProducts = location.pathname.startsWith(TIKTOK_SHOP_PRODUCTS_PATH);
  const isDashboard = location.pathname === TIKTOK_SHOP_DASHBOARD_PATH;

  return (
    <div className="px-1 py-3">
      <div className="mb-3">
        <h1 className="mb-0.5 text-xl font-bold text-gray-900">
          {t("digitalMarketing.tiktokShop.settingsTitle", "TikTok Shop")}
        </h1>
        <p className="text-xs text-gray-600">
          {t(
            "digitalMarketing.tiktokShop.headerDesc",
            "Connect sellers, sync stores, and view TikTok Shop order performance",
          )}
        </p>
      </div>

      <div className="-mb-3">
        <nav className="flex space-x-6" role="tablist">
          <ModuleTabNavItem
            pagePath={TIKTOK_SHOP_BASE_PATH}
            label={t("digitalMarketing.tiktokShop.tabDashboard", "Dashboard")}
            icon={LayoutDashboard}
            isActive={isDashboard}
            onActivate={() => navigate(TIKTOK_SHOP_DASHBOARD_PATH)}
            activeClassName={tabActive}
            inactiveClassName={tabInactive}
          />
          <ModuleTabNavItem
            pagePath={TIKTOK_SHOP_BASE_PATH}
            label={t("digitalMarketing.tiktokShop.tabProducts", "Products")}
            icon={Package}
            isActive={isProducts}
            onActivate={() => navigate(TIKTOK_SHOP_PRODUCTS_PATH)}
            activeClassName={tabActive}
            inactiveClassName={tabInactive}
          />
          <ModuleTabNavItem
            pagePath={TIKTOK_SHOP_BASE_PATH}
            label={t("digitalMarketing.tiktokShop.tabSettings", "Settings")}
            icon={Settings}
            isActive={isSettings}
            onActivate={() => navigate(TIKTOK_SHOP_SETTINGS_PATH)}
            activeClassName={tabActive}
            inactiveClassName={tabInactive}
          />
        </nav>
      </div>
    </div>
  );
}

TikTokShopHeaderAndTab.displayName = "TikTokShopHeaderAndTab";
