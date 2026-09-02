import { useLocation } from "react-router-dom";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import {
  STOCK_MANAGEMENT_ADJUSTMENT_PATH,
  STOCK_MANAGEMENT_MAPPING_PATH,
  STOCK_MANAGEMENT_PURCHASE_ORDERS_PATH,
  STOCK_MANAGEMENT_SUPPLIERS_PATH,
  STOCK_MANAGEMENT_SYNC_LOGS_PATH,
  STOCK_MANAGEMENT_TRANSFER_PATH,
} from "@/stock-management/lib/inventoryPaths";

type Props = {
  count?: number;
};

function sectionCopy(pathname: string): { key: string; fallback: string } {
  if (pathname.startsWith(STOCK_MANAGEMENT_ADJUSTMENT_PATH)) {
    return { key: "operations.stockManagement.tabAdjustment", fallback: "Adjustment" };
  }
  if (pathname.startsWith(STOCK_MANAGEMENT_PURCHASE_ORDERS_PATH)) {
    return { key: "operations.stockManagement.tabPurchaseOrders", fallback: "Purchase Order" };
  }
  if (pathname.startsWith(STOCK_MANAGEMENT_TRANSFER_PATH)) {
    return { key: "operations.stockManagement.tabTransfer", fallback: "Transfer" };
  }
  if (pathname.startsWith(STOCK_MANAGEMENT_SUPPLIERS_PATH)) {
    return { key: "operations.stockManagement.tabSuppliers", fallback: "Suppliers" };
  }
  if (pathname.startsWith(STOCK_MANAGEMENT_MAPPING_PATH)) {
    return { key: "operations.stockManagement.tabMapping", fallback: "Platform mapping" };
  }
  if (pathname.startsWith(STOCK_MANAGEMENT_SYNC_LOGS_PATH)) {
    return { key: "operations.stockManagement.tabSyncLogs", fallback: "Sync logs" };
  }
  return { key: "operations.stockManagement.tabInventory", fallback: "Summary" };
}

export function InventoryPanelFooter({ count = 0 }: Props) {
  const { t } = useAppTranslation();
  const { pathname } = useLocation();
  const section = sectionCopy(pathname);
  const sectionLabel = t(section.key, section.fallback);

  return (
    <div className="flex-shrink-0 border-t border-border bg-muted/50 px-4 py-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {t("operations.inventory.footer.showing", "Showing {{count}} {{section}}", {
            count,
            section: sectionLabel,
          })}
        </span>
        <span className="text-xs text-muted-foreground/80">
          {t("operations.inventory.footer.total", "Total: {{count}}", { count })}
        </span>
      </div>
    </div>
  );
}
