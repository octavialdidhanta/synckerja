import type { CustomerVisitCartLine } from "@/5-2-customer-visits/checkout/lib/customerVisitCheckout.types";
import { cartLineFingerprint } from "@/pos-mobile/2-cashier/lib/cartLineFingerprint";
import type { PublicOrderCatalogItem, PublicOrderItemOptions } from "@/synckerja-order/shared/lib/orderTypes";
import { sanitizeKitchenNote } from "./orderLineKitchenNote";
import {
  modifierDisplayName,
  orderCustomizeUnitPrice,
  selectedModifierRows,
  type OrderCustomizeSelection,
} from "./orderCustomizeSelection";

export function mapOrderCustomizeToCartLine(args: {
  item: PublicOrderCatalogItem;
  options: PublicOrderItemOptions;
  selection: OrderCustomizeSelection;
  quantity: number;
  kitchenNote?: string | null;
}): CustomerVisitCartLine {
  const qty = Math.max(1, Math.round(args.quantity || 1));
  const variant = args.options.variants.find((v) => v.id === args.selection.variantId);
  const modifiers = selectedModifierRows(args.options, args.selection).map((m) => ({
    optionId: m.optionId,
    name: m.name,
    extraPrice: m.extraPrice,
    quantity: m.quantity,
  }));
  const names = [
    variant?.name,
    ...modifiers.map((m) => modifierDisplayName(m.name, m.quantity)),
  ].filter((n): n is string => Boolean(n?.trim()));
  const kind =
    args.item.kind === "bundle" || args.options.kind === "bundle"
      ? "bundle"
      : args.item.kind === "service"
        ? "service"
        : "product";
  const draft: CustomerVisitCartLine = {
    lineKey: "",
    catalogId: args.item.id,
    kind,
    serviceId: args.item.service_id,
    subServiceId: args.item.sub_service_id,
    serviceName: args.item.name,
    subServiceName: names.length > 0 ? names.join(" · ") : null,
    quantity: qty,
    unitPrice: orderCustomizeUnitPrice(args.options, args.selection),
    photoUrl: args.item.photo_url ?? null,
    trackStock: args.item.track_stock,
    inventorySkuId: args.item.inventory_sku_id,
    availableQty: args.item.available_qty,
    productCategoryId: args.item.product_category_id,
    productCategoryName: args.item.product_category_name,
    variantId: variant?.id ?? null,
    variantName: variant?.name ?? null,
    modifiers,
    kitchenNote: sanitizeKitchenNote(args.kitchenNote),
  };
  draft.lineKey = cartLineFingerprint(draft);
  return draft;
}
