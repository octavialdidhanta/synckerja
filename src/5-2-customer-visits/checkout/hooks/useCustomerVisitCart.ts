import { useMemo, useState } from 'react';
import type { CustomerVisitCartLine, CustomerVisitCatalogItem } from '../lib/customerVisitCheckout.types';
import { isCatalogItemOutOfStock } from '../lib/catalogLabel';
import { sumCustomerVisitCart } from '../lib/sumCustomerVisitCart';

function toCartLine(item: CustomerVisitCatalogItem, quantity = 1): CustomerVisitCartLine {
  return {
    catalogId: item.id,
    kind: item.kind,
    serviceId: item.serviceId,
    subServiceId: item.subServiceId,
    serviceName: item.serviceName,
    subServiceName: item.subServiceName,
    quantity,
    unitPrice: item.unitPrice,
    photoUrl: item.photoUrl,
    unit: item.unit,
    trackStock: item.trackStock,
    inventorySkuId: item.inventorySkuId,
    availableQty: item.availableQty,
  };
}

export function useCustomerVisitCart() {
  const [lines, setLines] = useState<CustomerVisitCartLine[]>([]);
  const totals = useMemo(() => sumCustomerVisitCart(lines), [lines]);

  const addItem = (item: CustomerVisitCatalogItem) => {
    if (!(item.unitPrice > 0)) return;
    if (isCatalogItemOutOfStock(item)) return;
    setLines((prev) => {
      const existing = prev.find((line) => line.catalogId === item.id);
      if (existing) {
        const nextQty = existing.quantity + 1;
        if (
          item.kind === 'product' &&
          item.trackStock &&
          item.availableQty != null &&
          nextQty > item.availableQty
        ) {
          return prev;
        }
        return prev.map((line) =>
          line.catalogId === item.id ? { ...line, quantity: nextQty, availableQty: item.availableQty } : line,
        );
      }
      return [...prev, toCartLine(item)];
    });
  };

  const updateQty = (catalogId: string, quantity: number) => {
    setLines((prev) => {
      if (quantity <= 0) return prev.filter((line) => line.catalogId !== catalogId);
      return prev.map((line) => {
        if (line.catalogId !== catalogId) return line;
        if (
          line.kind === 'product' &&
          line.trackStock &&
          line.availableQty != null &&
          quantity > line.availableQty
        ) {
          return line;
        }
        return { ...line, quantity };
      });
    });
  };

  const updatePrice = (catalogId: string, unitPrice: number) => {
    setLines((prev) =>
      prev.map((line) => (line.catalogId === catalogId ? { ...line, unitPrice } : line)),
    );
  };

  const reset = () => setLines([]);

  return { lines, totals, addItem, updateQty, updatePrice, reset };
}
