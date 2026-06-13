import { LayoutDashboard, Link2, ScrollText } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ModuleTabNavItem } from "@/shared/auth/page-access/ModuleTabNavItem";
import {
  STOCK_MANAGEMENT_BASE_PATH,
  STOCK_MANAGEMENT_DASHBOARD_PATH,
  STOCK_MANAGEMENT_MAPPING_PATH,
  STOCK_MANAGEMENT_SYNC_LOGS_PATH,
} from "@/stock-management/lib/inventoryPaths";

const tabActive = "border-primary text-primary";
const tabInactive =
  "border-transparent text-muted-foreground hover:border-border hover:text-foreground";

export function StockManagementHeaderAndTab() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const isDashboard = location.pathname === STOCK_MANAGEMENT_DASHBOARD_PATH;
  const isMapping = location.pathname.startsWith(STOCK_MANAGEMENT_MAPPING_PATH);
  const isSyncLogs = location.pathname.startsWith(STOCK_MANAGEMENT_SYNC_LOGS_PATH);

  return (
    <div className="px-1 py-3">
      <div className="mb-3">
        <h1 className="mb-0.5 text-xl font-bold text-gray-900">
          {t("operations.stockManagement.title", "Stock Management")}
        </h1>
        <p className="text-xs text-gray-600">
          {t(
            "operations.stockManagement.headerDesc",
            "Central inventory shared across TikTok Shop, Shopee, Tokopedia, BliBli, and other channels",
          )}
        </p>
      </div>

      <div className="-mb-3">
        <nav className="flex space-x-6" role="tablist">
          <ModuleTabNavItem
            pagePath={STOCK_MANAGEMENT_BASE_PATH}
            label={t("operations.stockManagement.tabInventory", "Inventory")}
            icon={LayoutDashboard}
            isActive={isDashboard}
            onActivate={() => navigate(STOCK_MANAGEMENT_DASHBOARD_PATH)}
            activeClassName={tabActive}
            inactiveClassName={tabInactive}
          />
          <ModuleTabNavItem
            pagePath={STOCK_MANAGEMENT_BASE_PATH}
            label={t("operations.stockManagement.tabMapping", "Platform mapping")}
            icon={Link2}
            isActive={isMapping}
            onActivate={() => navigate(STOCK_MANAGEMENT_MAPPING_PATH)}
            activeClassName={tabActive}
            inactiveClassName={tabInactive}
          />
          <ModuleTabNavItem
            pagePath={STOCK_MANAGEMENT_BASE_PATH}
            label={t("operations.stockManagement.tabSyncLogs", "Sync logs")}
            icon={ScrollText}
            isActive={isSyncLogs}
            onActivate={() => navigate(STOCK_MANAGEMENT_SYNC_LOGS_PATH)}
            activeClassName={tabActive}
            inactiveClassName={tabInactive}
          />
        </nav>
      </div>
    </div>
  );
}

StockManagementHeaderAndTab.displayName = "StockManagementHeaderAndTab";
