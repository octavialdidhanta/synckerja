import { applyCatalogCheckoutStock } from "@/stock-management/catalog-ledger/applyCatalogCheckoutStock";
import type { CustomerVisitCartLine } from "@/5-2-customer-visits/checkout/lib/customerVisitCheckout.types";
import { catalogCheckoutSaleLines } from "@/5-2-customer-visits/checkout/lib/storeCheckoutStock";

export async function applyCatalogCheckoutStockForLines(args: {
  organizationId: string;
  outletId?: string | null;
  activityId: string;
  lines: CustomerVisitCartLine[];
}): Promise<void> {
  const payload = catalogCheckoutSaleLines(args.lines);
  if (payload.length === 0) return;
  await applyCatalogCheckoutStock({
    organizationId: args.organizationId,
    outletId: args.outletId ?? null,
    activityId: args.activityId,
    lines: payload,
  });
}
