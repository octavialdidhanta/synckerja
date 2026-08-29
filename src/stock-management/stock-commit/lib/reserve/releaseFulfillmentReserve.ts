import type { CustomerVisitCartLine } from "@/5-2-customer-visits/checkout/lib/customerVisitCheckout.types";
import { releaseCatalogStockReserve } from "../../rpc/applyCatalogStockReserve";
import { reserveTargetLinesFromCart } from "./computeReserveDelta";

export async function releaseAllFulfillmentReserveForSession(args: {
  organizationId: string;
  outletId: string;
  sessionId: string;
  releaseId?: string;
}): Promise<void> {
  await releaseCatalogStockReserve({
    organizationId: args.organizationId,
    outletId: args.outletId,
    sessionId: args.sessionId,
    lines: null,
    releaseId: args.releaseId ?? `cancel-${args.sessionId}`,
  });
}

export async function releaseFulfillmentReserveFromCart(args: {
  organizationId: string;
  outletId: string;
  sessionId: string;
  cartLines: CustomerVisitCartLine[];
  releaseId?: string;
}): Promise<void> {
  const lines = reserveTargetLinesFromCart(args.cartLines).map((l) => ({
    product_id: l.product_id,
    qty: l.qty,
    variant_id: l.variant_id,
  }));
  if (lines.length === 0) return;

  await releaseCatalogStockReserve({
    organizationId: args.organizationId,
    outletId: args.outletId,
    sessionId: args.sessionId,
    lines,
    releaseId: args.releaseId,
  });
}
