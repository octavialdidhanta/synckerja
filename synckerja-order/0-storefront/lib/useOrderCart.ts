import { useMemo, useState } from "react";
import type { CustomerVisitCartLine } from "@/5-2-customer-visits/checkout/lib/customerVisitCheckout.types";
import { cartLineFingerprint } from "@/pos-mobile/2-cashier/lib/cartLineFingerprint";
import type { PublicOrderCatalogItem } from "@/synckerja-order/shared/lib/orderTypes";
import {
  bumpLastLineForCatalogId,
  mergeCustomizedCartLine,
  removeLastLineForCatalogId,
  replaceCartLine,
} from "./orderCartLines";

export function catalogItemToCartLine(
  item: PublicOrderCatalogItem,
  variant?: { id: string; name: string; price: number },
): CustomerVisitCartLine {
  const unitPrice = variant ? variant.price : item.unit_price;
  const line: CustomerVisitCartLine = {
    lineKey: "",
    catalogId: item.id,
    kind: item.kind === "bundle" ? "bundle" : item.kind === "service" ? "service" : "product",
    serviceId: item.service_id,
    subServiceId: item.sub_service_id,
    serviceName: item.name,
    subServiceName: variant?.name ?? null,
    quantity: 1,
    unitPrice,
    photoUrl: item.photo_url ?? null,
    trackStock: item.track_stock,
    inventorySkuId: item.inventory_sku_id,
    availableQty: item.available_qty,
    productCategoryId: item.product_category_id,
    productCategoryName: item.product_category_name,
    variantId: variant?.id ?? null,
    variantName: variant?.name ?? null,
  };
  return { ...line, lineKey: cartLineFingerprint(line) };
}

export function useOrderCart(locked = false) {
  const [lines, setLines] = useState<CustomerVisitCartLine[]>([]);

  const add = (item: PublicOrderCatalogItem, variant?: { id: string; name: string; price: number }) => {
    if (locked) return;
    const incoming = catalogItemToCartLine(item, variant);
    setLines((prev) => {
      const existing = prev.find((l) => l.lineKey === incoming.lineKey);
      if (!existing) return [...prev, incoming];
      return prev.map((l) =>
        l.lineKey === incoming.lineKey ? { ...l, quantity: l.quantity + 1 } : l,
      );
    });
  };

  const removeOne = (item: PublicOrderCatalogItem, variant?: { id: string; name: string; price: number }) => {
    if (locked) return;
    const incoming = catalogItemToCartLine(item, variant);
    setLines((prev) => {
      const existing = prev.find((l) => l.lineKey === incoming.lineKey);
      if (!existing) return prev;
      if (existing.quantity <= 1) return prev.filter((l) => l.lineKey !== incoming.lineKey);
      return prev.map((l) =>
        l.lineKey === incoming.lineKey ? { ...l, quantity: l.quantity - 1 } : l,
      );
    });
  };

  const addCustomizedLine = (incoming: CustomerVisitCartLine) => {
    if (locked || incoming.quantity <= 0) return;
    setLines((prev) => mergeCustomizedCartLine(prev, incoming));
  };

  const removeLastForCatalogId = (catalogId: string) => {
    if (locked) return;
    setLines((prev) => removeLastLineForCatalogId(prev, catalogId));
  };

  const bumpLastForCatalogId = (catalogId: string) => {
    if (locked) return;
    setLines((prev) => bumpLastLineForCatalogId(prev, catalogId));
  };

  const replaceLine = (lineKey: string, next: CustomerVisitCartLine) => {
    if (locked) return;
    setLines((prev) => replaceCartLine(prev, lineKey, next));
  };

  const setQty = (lineKey: string, quantity: number) => {
    setLines((prev) => {
      if (quantity <= 0) return prev.filter((l) => l.lineKey !== lineKey);
      return prev.map((l) => (l.lineKey === lineKey ? { ...l, quantity } : l));
    });
  };

  const clear = () => setLines([]);

  const subtotal = useMemo(
    () => lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0),
    [lines],
  );

  const itemCount = useMemo(
    () => lines.reduce((sum, l) => sum + l.quantity, 0),
    [lines],
  );

  return {
    lines,
    add,
    addCustomizedLine,
    replaceLine,
    removeOne,
    removeLastForCatalogId,
    bumpLastForCatalogId,
    setQty,
    clear,
    subtotal,
    itemCount,
  };
}
