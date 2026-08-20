import { LayoutDashboard, Link2, ScrollText, Scale, ClipboardList, Truck } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ModuleTabNavItem } from "@/shared/auth/page-access/ModuleTabNavItem";
import {
  STOCK_MANAGEMENT_DASHBOARD_PATH,
  STOCK_MANAGEMENT_ADJUSTMENT_PATH,
  STOCK_MANAGEMENT_PURCHASE_ORDERS_PATH,
  STOCK_MANAGEMENT_SUPPLIERS_PATH,
  STOCK_MANAGEMENT_MAPPING_PATH,
  STOCK_MANAGEMENT_PAGE_ACCESS_PATH,
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
  const isAdjustment = location.pathname.startsWith(STOCK_MANAGEMENT_ADJUSTMENT_PATH);
  const isPurchaseOrders = location.pathname.startsWith(STOCK_MANAGEMENT_PURCHASE_ORDERS_PATH);
  const isSuppliers = location.pathname.startsWith(STOCK_MANAGEMENT_SUPPLIERS_PATH);
  const isMapping = location.pathname.startsWith(STOCK_MANAGEMENT_MAPPING_PATH);
  const isSyncLogs = location.pathname.startsWith(STOCK_MANAGEMENT_SYNC_LOGS_PATH);

  return (
    <div className="px-1 py-3">
      <div className="mb-3">
        <h1 className="mb-0.5 text-xl font-bold text-gray-900">
          {t("operations.stockManagement.title", "Inventory")}
        </h1>
        <p className="text-xs text-gray-600">
          {t(
            "operations.stockManagement.headerDesc",
            "Shared inventory for Item Library and e-commerce channels",
          )}
        </p>
      </div>

      <div className="-mb-3">
        <nav className="flex space-x-6" role="tablist">
          <ModuleTabNavItem
            pagePath={STOCK_MANAGEMENT_PAGE_ACCESS_PATH}
            label={t("operations.stockManagement.tabInventory", "Summary")}
            icon={LayoutDashboard}
            isActive={isDashboard}
            onActivate={() => navigate(STOCK_MANAGEMENT_DASHBOARD_PATH)}
            activeClassName={tabActive}
            inactiveClassName={tabInactive}
          />
          <ModuleTabNavItem
            pagePath={STOCK_MANAGEMENT_PAGE_ACCESS_PATH}
            label={t("operations.stockManagement.tabSuppliers", "Suppliers")}
            icon={Truck}
            isActive={isSuppliers}
            onActivate={() => navigate(STOCK_MANAGEMENT_SUPPLIERS_PATH)}
            activeClassName={tabActive}
            inactiveClassName={tabInactive}
          />
          <ModuleTabNavItem
            pagePath={STOCK_MANAGEMENT_PAGE_ACCESS_PATH}
            label={t("operations.stockManagement.tabPurchaseOrders", "Purchase Order")}
            icon={ClipboardList}
            isActive={isPurchaseOrders}
            onActivate={() => navigate(STOCK_MANAGEMENT_PURCHASE_ORDERS_PATH)}
            activeClassName={tabActive}
            inactiveClassName={tabInactive}
          />
          <ModuleTabNavItem
            pagePath={STOCK_MANAGEMENT_PAGE_ACCESS_PATH}
            label={t("operations.stockManagement.tabAdjustment", "Adjustment")}
            icon={Scale}
            isActive={isAdjustment}
            onActivate={() => navigate(STOCK_MANAGEMENT_ADJUSTMENT_PATH)}
            activeClassName={tabActive}
            inactiveClassName={tabInactive}
          />
          <ModuleTabNavItem
            pagePath={STOCK_MANAGEMENT_PAGE_ACCESS_PATH}
            label={t("operations.stockManagement.tabMapping", "Platform mapping")}
            icon={Link2}
            isActive={isMapping}
            onActivate={() => navigate(STOCK_MANAGEMENT_MAPPING_PATH)}
            activeClassName={tabActive}
            inactiveClassName={tabInactive}
          />
          <ModuleTabNavItem
            pagePath={STOCK_MANAGEMENT_PAGE_ACCESS_PATH}
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
