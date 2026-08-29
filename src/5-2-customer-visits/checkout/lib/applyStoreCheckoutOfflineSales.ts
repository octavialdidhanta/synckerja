import { recordOfflineSale } from "@/stock-management/lib/inventoryApi";
import { applyCatalogCheckoutStock } from "@/stock-management/catalog-ledger/applyCatalogCheckoutStock";
import type { CustomerVisitCartLine } from "./customerVisitCheckout.types";
import { catalogCheckoutSaleLines, offlineSalePayloads } from "./storeCheckoutStock";

export type StoreCheckoutStockLineInput = CustomerVisitCartLine & {
  stockScope?: "full" | "recipe_only" | "finished_goods_only";
};

export async function applyStoreCheckoutOfflineSales(args: {
  organizationId: string;
  activityId: string;
  outletId?: string | null;
  lines: CustomerVisitCartLine[];
  /** When set, only deduct stock for these lines (POS kitchen skip committed). */
  stockLines?: StoreCheckoutStockLineInput[];
}): Promise<void> {
  const deductLines = args.stockLines ?? args.lines;
  const payloads = offlineSalePayloads(args.activityId, deductLines);
  for (const payload of payloads) {
    await recordOfflineSale(args.organizationId, payload.skuId, payload.qty, "Store checkout", {
      referenceType: payload.referenceType,
      referenceId: payload.referenceId,
    });
  }
  await applyCatalogCheckoutStock({
    organizationId: args.organizationId,
    outletId: args.outletId ?? null,
    activityId: args.activityId,
    lines: catalogCheckoutSaleLines(deductLines),
  });
}
