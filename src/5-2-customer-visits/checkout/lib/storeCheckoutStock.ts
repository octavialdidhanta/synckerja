import { isTrackedProduct } from '@/8-2-1-default-prices/lib/catalogKind';

export type StoreCheckoutStockLine = {
  kind?: string | null;
  catalogId?: string | null;
  trackStock?: boolean | null;
  inventorySkuId?: string | null;
  quantity: number;
  availableQty?: number | null;
  label?: string;
  variantId?: string | null;
  modifiers?: Array<{ optionId: string }> | null;
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
  return trackedStoreCheckoutLines(lines)
    .filter((line) => Boolean(line.inventorySkuId))
    .map((line) => ({
      skuId: String(line.inventorySkuId),
      qty: line.quantity,
      referenceType: 'store_checkout' as const,
      referenceId: activityId,
    }));
}

export type CatalogCheckoutSaleLine = {
  productId: string;
  qty: number;
  variantId?: string | null;
  modifierOptionIds?: string[];
  lineKey?: string;
  stockScope?: "full" | "recipe_only" | "finished_goods_only";
};

export function catalogCheckoutSaleLines(
  lines: Array<
    StoreCheckoutStockLine & {
      stockScope?: "full" | "recipe_only" | "finished_goods_only";
      lineKey?: string;
    }
  >,
): CatalogCheckoutSaleLine[] {
  const out: CatalogCheckoutSaleLine[] = [];
  for (const line of lines) {
    // Send every product line: RPC deducts by stock_scope (default full).
    if (line.kind !== "product" || !line.catalogId || !(Number(line.quantity) > 0)) continue;
    const modifierOptionIds = (line.modifiers ?? [])
      .map((m) => m.optionId)
      .filter((id): id is string => Boolean(id));
    out.push({
      productId: String(line.catalogId),
      qty: line.quantity,
      variantId: line.variantId ?? null,
      modifierOptionIds,
      lineKey: line.lineKey ?? `L${out.length + 1}`,
      stockScope: line.stockScope,
    });
  }
  return out;
}
