import type { CustomerVisitCatalogItem } from "@/5-2-customer-visits/checkout/lib/customerVisitCheckout.types";

/** Match scanned code to catalog SKU (case-insensitive). MVP: product-level SKU only. */
export function findCatalogItemByScanCode(
  items: CustomerVisitCatalogItem[],
  code: string,
): CustomerVisitCatalogItem | null {
  const needle = code.trim().toLowerCase();
  if (!needle) return null;
  for (const item of items) {
    const sku = item.catalogSku?.trim().toLowerCase();
    if (sku && sku === needle) return item;
  }
  return null;
}
