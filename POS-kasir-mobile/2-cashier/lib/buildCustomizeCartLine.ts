import type {
  CustomerVisitCartLine,
  CustomerVisitCartLineDiscount,
  CustomerVisitCartModifier,
  CustomerVisitCatalogItem,
} from "@/5-2-customer-visits/checkout/lib/customerVisitCheckout.types";
import { cartLineFingerprint } from "./cartLineFingerprint";
import {
  buildCustomizeSubServiceName,
  computeCustomizeUnitPrice,
} from "./computeCustomizeUnitPrice";

export type CustomizeSelection = {
  item: CustomerVisitCatalogItem;
  quantity: number;
  variantId: string | null;
  variantName: string | null;
  /** Base price before modifiers (variant / STP / catalog). */
  baseUnitPrice: number;
  modifiers: CustomerVisitCartModifier[];
  lineDiscount: CustomerVisitCartLineDiscount | null;
  lineSalesTypeId: string | null;
  lineSalesTypeLabel: string | null;
};

export function buildCustomizeCartLine(selection: CustomizeSelection): CustomerVisitCartLine {
  const qty = Math.max(1, Math.round(selection.quantity));
  const unitPrice = computeCustomizeUnitPrice({
    baseUnitPrice: selection.baseUnitPrice,
    modifiers: selection.modifiers,
    lineDiscountAmountRp: selection.lineDiscount?.amountRp ?? 0,
    quantity: qty,
  });

  const draft: CustomerVisitCartLine = {
    lineKey: "",
    catalogId: selection.item.id,
    kind: selection.item.kind,
    serviceId: selection.item.serviceId,
    subServiceId: selection.item.subServiceId,
    serviceName: selection.item.serviceName,
    subServiceName: buildCustomizeSubServiceName({
      unit: selection.item.unit,
      variantName: selection.variantName,
      modifiers: selection.modifiers,
      lineSalesTypeLabel: selection.lineSalesTypeLabel,
    }),
    quantity: qty,
    unitPrice,
    photoUrl: selection.item.photoUrl,
    unit: selection.item.unit,
    trackStock: selection.item.trackStock,
    inventorySkuId: selection.item.inventorySkuId,
    availableQty: selection.item.availableQty,
    productCategoryId: selection.item.productCategoryId,
    productCategoryName: selection.item.productCategoryName,
    variantId: selection.variantId,
    variantName: selection.variantName,
    modifiers: selection.modifiers,
    lineDiscount: selection.lineDiscount,
    lineSalesTypeId: selection.lineSalesTypeId,
    lineSalesTypeLabel: selection.lineSalesTypeLabel,
  };
  draft.lineKey = cartLineFingerprint(draft);
  return draft;
}
