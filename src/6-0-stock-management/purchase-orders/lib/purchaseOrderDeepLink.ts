import { STOCK_MANAGEMENT_PURCHASE_ORDERS_PATH } from "@/stock-management/lib/inventoryPaths";
import type { PurchaseOrderKindFilter } from "../types";

export const PO_DEEP_LINK_ID_PARAM = "po";
export const PO_DEEP_LINK_KIND_PARAM = "kind";

/** purchase_requests.purchase_type dari sync_catalog_po_purchase_request: "Inventory Item" = produk, "Inventory" = bahan. */
export function poKindFromPurchaseType(purchaseType: string | null | undefined): PurchaseOrderKindFilter {
  return String(purchaseType ?? "").trim().toLowerCase() === "inventory item" ? "item_library" : "ingredients";
}

export function purchaseOrderDetailHref(
  purchaseOrderId: string,
  purchaseType: string | null | undefined,
): string {
  const params = new URLSearchParams({
    [PO_DEEP_LINK_ID_PARAM]: purchaseOrderId,
    [PO_DEEP_LINK_KIND_PARAM]: poKindFromPurchaseType(purchaseType),
  });
  return `${STOCK_MANAGEMENT_PURCHASE_ORDERS_PATH}?${params.toString()}`;
}

export function parsePoDeepLinkKind(value: string | null): PurchaseOrderKindFilter | null {
  return value === "ingredients" || value === "item_library" ? value : null;
}
