import type { CustomerVisitCartLine } from "@/5-2-customer-visits/checkout/lib/customerVisitCheckout.types";
import { lineTotal } from "@/5-2-customer-visits/checkout/lib/sumCustomerVisitCart";

export function cartLinePayableTotal(line: CustomerVisitCartLine): number {
  let total = lineTotal(line);
  for (const mod of line.modifiers ?? []) {
    total += Math.max(0, Number(mod.extraPrice) || 0) * line.quantity;
  }
  const discount = Math.max(0, Number(line.lineDiscount?.amountRp) || 0);
  return Math.max(0, total - discount);
}

export function computeCartSnapshotTotal(snapshot: unknown): number {
  if (!Array.isArray(snapshot)) return 0;
  return snapshot.reduce((sum, raw) => {
    const line = raw as Partial<CustomerVisitCartLine>;
    if (!line || typeof line !== "object") return sum;
    const qty = Number(line.quantity);
    const price = Number(line.unitPrice);
    if (!Number.isFinite(qty) || !Number.isFinite(price) || qty <= 0) return sum;
    return sum + cartLinePayableTotal(line as CustomerVisitCartLine);
  }, 0);
}

export function parseCartSnapshot(snapshot: unknown): CustomerVisitCartLine[] {
  if (!Array.isArray(snapshot)) return [];
  return snapshot.filter((row): row is CustomerVisitCartLine => Boolean(row && typeof row === "object"));
}
