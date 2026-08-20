import type {
  CatalogProductVariant,
  CatalogProductVariantOutletStock,
  CogsRowDraft,
  InventoryRowDraft,
  ProductOutletStock,
} from "../types";
import { emptyOutletStock } from "../types";

export function parseStockQty(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function stockToInventoryDraft(
  variantId: string | null,
  stock: ProductOutletStock | undefined,
  trackStock: boolean,
): InventoryRowDraft {
  const row = stock ?? emptyOutletStock();
  return {
    variantId,
    trackStock,
    inStock: row.in_stock ? String(row.in_stock) : "",
    alertEnabled: row.alert_enabled,
    alertAt: row.alert_at == null ? "" : String(row.alert_at),
  };
}

export function draftToOutletStock(
  draft: InventoryRowDraft,
  cogs: CogsRowDraft | undefined,
  lockTracking: boolean,
): ProductOutletStock {
  const track = lockTracking || draft.trackStock;
  const alertAt = draft.alertAt.trim() ? Number(draft.alertAt) : null;
  return {
    in_stock: track ? parseStockQty(draft.inStock) : 0,
    alert_enabled: track && draft.alertEnabled,
    alert_at: track && draft.alertEnabled && alertAt != null && Number.isFinite(alertAt) && alertAt >= 0 ? alertAt : null,
    track_cogs: track && Boolean(cogs?.trackCogs),
    avg_cost: track && cogs?.trackCogs ? parseStockQty(cogs.avgCost) : 0,
  };
}

export function outletQtyForTable(args: {
  trackStock: boolean;
  outletId: string | null;
  variants: CatalogProductVariant[];
  productStock?: ProductOutletStock | null;
  variantStocks?: CatalogProductVariantOutletStock[];
}): number | null {
  if (!args.trackStock || !args.outletId) return args.trackStock ? 0 : null;
  if (args.variants.length === 0) {
    return args.productStock?.in_stock ?? 0;
  }
  return (args.variantStocks ?? [])
    .filter((row) => row.outlet_id === args.outletId)
    .reduce((sum, row) => sum + (Number(row.in_stock) || 0), 0);
}
