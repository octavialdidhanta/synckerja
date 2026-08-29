import type { CustomerVisitCatalogItem } from "@/5-2-customer-visits/checkout/lib/customerVisitCheckout.types";

/** True when Favorit/Library tap must open customize dialog before adding to cart. Bundles skip this. */
export function needsItemCustomize(item: CustomerVisitCatalogItem): boolean {
  if (item.kind !== "product") return false;
  if ((item.variantCount ?? 0) > 0) return true;
  if (item.hasModifiers) return true;
  if (item.useSalesTypePrices && item.hasSalesTypePrices) return true;
  return false;
}
