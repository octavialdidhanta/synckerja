import type { CustomerVisitCartLine } from "@/5-2-customer-visits/checkout/lib/customerVisitCheckout.types";
import type { PosSessionStockReserve } from "../../types/sessionStockReserve";
import { reserveVariantKey } from "../../types/sessionStockReserve";

export type ReserveTargetLine = {
  product_id: string;
  variant_id: string | null;
  qty: number;
};

export type ReserveDeltaLine = ReserveTargetLine & {
  currentQty: number;
  deltaQty: number;
};

function reserveLedgerKey(productId: string, variantId: string | null | undefined): string {
  return `${productId}:${reserveVariantKey(variantId)}`;
}

/** Aggregate tracked FG lines into product+variant target qty (sum duplicates). */
export function aggregateReserveTargetsFromCart(
  lines: CustomerVisitCartLine[],
): ReserveTargetLine[] {
  const byKey = new Map<string, ReserveTargetLine>();

  for (const line of lines) {
    if (line.isCustomAmount || line.kind !== "product" || !line.trackStock) continue;
    const qty = Number(line.quantity) || 0;
    if (qty <= 0) continue;

    const variantId = line.variantId ?? null;
    const key = reserveLedgerKey(line.catalogId, variantId);
    const existing = byKey.get(key);
    if (existing) {
      existing.qty += qty;
    } else {
      byKey.set(key, {
        product_id: line.catalogId,
        variant_id: variantId,
        qty,
      });
    }
  }

  return [...byKey.values()];
}

export function computeReserveDelta(args: {
  cartLines: CustomerVisitCartLine[];
  reserves: PosSessionStockReserve[];
}): ReserveDeltaLine[] {
  const reserveByKey = new Map<string, PosSessionStockReserve>();
  for (const r of args.reserves) {
    reserveByKey.set(reserveLedgerKey(r.product_id, r.variant_id), r);
  }

  const targets = aggregateReserveTargetsFromCart(args.cartLines);
  const deltas: ReserveDeltaLine[] = [];

  for (const target of targets) {
    const key = reserveLedgerKey(target.product_id, target.variant_id);
    const current = reserveByKey.get(key);
    const currentQty = current ? Number(current.reserved_qty) || 0 : 0;
    const deltaQty = target.qty - currentQty;
    if (deltaQty === 0) continue;
    deltas.push({
      ...target,
      currentQty,
      deltaQty,
    });
  }

  return deltas;
}

/** Target lines for RPC (full cart snapshot qty per product+variant). */
export function reserveTargetLinesFromCart(
  cartLines: CustomerVisitCartLine[],
): ReserveTargetLine[] {
  return aggregateReserveTargetsFromCart(cartLines);
}
