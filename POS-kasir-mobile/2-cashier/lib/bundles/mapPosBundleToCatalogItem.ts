import type { CustomerVisitCatalogItem } from "@/5-2-customer-visits/checkout/lib/customerVisitCheckout.types";
import type { PosOutletBundle } from "./posBundleTypes";

export function mapPosBundleToCatalogItem(
  bundle: PosOutletBundle,
  unitPrice: number,
): CustomerVisitCatalogItem {
  return {
    id: bundle.id,
    kind: "bundle",
    serviceId: null,
    subServiceId: null,
    serviceName: bundle.name,
    subServiceName: null,
    unitPrice,
    photoUrl: bundle.photoUrl,
    unit: null,
    trackStock: false,
    inventorySkuId: null,
    availableQty: null,
    productCategoryId: null,
    productCategoryName: null,
    posStatus: "available",
    variantCount: 0,
    hasModifiers: false,
    useSalesTypePrices: bundle.useSalesTypePrices,
    hasSalesTypePrices: bundle.useSalesTypePrices && bundle.salesTypePrices.length > 0,
  };
}
