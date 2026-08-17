import { isTrackedProduct } from '@/8-2-1-default-prices/lib/catalogKind';

export type StoreCheckoutStockLine = {
  kind?: string | null;
  trackStock?: boolean | null;
  inventorySkuId?: string | null;
  quantity: number;
  availableQty?: number | null;
  label?: string;
};

export function trackedStoreCheckoutLines(lines: StoreCheckoutStockLine[]): StoreCheckoutStockLine[] {
  return lines.filter((line) => isTrackedProduct(line) && Number(line.quantity) > 0);
}

export function findInsufficientStoreCheckoutStock(
  lines: StoreCheckoutStockLine[],
): StoreCheckoutStockLine | null {
  for (const line of trackedStoreCheckoutLines(lines)) {
    const available = Number(line.availableQty);
    if (!Number.isFinite(available) || line.quantity > available) return line;
  }
  return null;
}

export function isDuplicateOfflineSale(args: {
  existingReferenceIds: string[];
  activityId: string;
}): boolean {
  return args.existingReferenceIds.includes(args.activityId);
}

export type StoreCheckoutOfflineSalePayload = {
  skuId: string;
  qty: number;
  referenceType: 'store_checkout';
  referenceId: string;
};

export function offlineSalePayloads(
  activityId: string,
  lines: StoreCheckoutStockLine[],
): StoreCheckoutOfflineSalePayload[] {
  return trackedStoreCheckoutLines(lines).map((line) => ({
    skuId: String(line.inventorySkuId),
    qty: line.quantity,
    referenceType: 'store_checkout' as const,
    referenceId: activityId,
  }));
}
