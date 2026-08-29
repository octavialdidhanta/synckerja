import { useMemo, useState } from 'react';
import type { CustomerVisitCartLine, CustomerVisitCatalogItem } from '../lib/customerVisitCheckout.types';
import { isCatalogItemOutOfStock } from '../lib/catalogLabel';
import { sumCustomerVisitCart } from '../lib/sumCustomerVisitCart';

function isPlainLine(line: CustomerVisitCartLine): boolean {
  return (
    !line.isCustomAmount &&
    !line.variantId &&
    !(line.modifiers && line.modifiers.length > 0) &&
    !line.lineDiscount &&
    !line.lineSalesTypeId
  );
}

function toCartLine(item: CustomerVisitCatalogItem, quantity = 1): CustomerVisitCartLine {
  return {
    lineKey: `plain:${item.id}`,
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
    productCategoryId: item.productCategoryId,
    productCategoryName: item.productCategoryName,
  };
}

export function useCustomerVisitCart() {
  const [lines, setLines] = useState<CustomerVisitCartLine[]>([]);
  const totals = useMemo(() => sumCustomerVisitCart(lines), [lines]);

  const addItem = (item: CustomerVisitCatalogItem) => {
    if (!(item.unitPrice > 0)) return;
    if (isCatalogItemOutOfStock(item)) return;
    setLines((prev) => {
      const existing = prev.find(
        (line) => line.catalogId === item.id && isPlainLine(line),
      );
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
          line.lineKey === existing.lineKey
            ? { ...line, quantity: nextQty, availableQty: item.availableQty }
            : line,
        );
      }
      return [...prev, toCartLine(item)];
    });
  };

  const addCustomizedLine = (line: CustomerVisitCartLine) => {
    if (!(line.unitPrice > 0) || line.quantity <= 0) return;
    const key = line.lineKey || `plain:${line.catalogId}`;
    setLines((prev) => {
      const existing = prev.find((row) => row.lineKey === key);
      if (existing) {
        const nextQty = existing.quantity + line.quantity;
        if (
          line.kind === 'product' &&
          line.trackStock &&
          line.availableQty != null &&
          nextQty > line.availableQty
        ) {
          return prev;
        }
        return prev.map((row) =>
          row.lineKey === key
            ? { ...row, quantity: nextQty, availableQty: line.availableQty }
            : row,
        );
      }
      return [...prev, { ...line, lineKey: key }];
    });
  };

  const addCustomAmount = (line: CustomerVisitCartLine) => {
    if (!line.isCustomAmount || !(line.unitPrice > 0)) return;
    const withKey: CustomerVisitCartLine = {
      ...line,
      lineKey: line.lineKey || `custom:${crypto.randomUUID()}`,
    };
    setLines((prev) => [...prev, withKey]);
  };

  const updateQty = (lineKey: string, quantity: number) => {
    setLines((prev) => {
      if (quantity <= 0) return prev.filter((line) => line.lineKey !== lineKey);
      return prev.map((line) => {
        if (line.lineKey !== lineKey) return line;
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

  const updatePrice = (lineKey: string, unitPrice: number) => {
    setLines((prev) =>
      prev.map((line) => (line.lineKey === lineKey ? { ...line, unitPrice } : line)),
    );
  };

  const reset = () => setLines([]);

  const replaceLines = (next: CustomerVisitCartLine[]) => {
    setLines(
      (Array.isArray(next) ? next : []).map((line) => ({
        ...line,
        lineKey:
          line.lineKey ||
          (line.isCustomAmount
            ? `custom:${crypto.randomUUID()}`
            : isPlainLine(line)
              ? `plain:${line.catalogId}`
              : `plain:${line.catalogId}`),
      })),
    );
  };

  return {
    lines,
    totals,
    addItem,
    addCustomizedLine,
    addCustomAmount,
    updateQty,
    updatePrice,
    reset,
    replaceLines,
  };
}
