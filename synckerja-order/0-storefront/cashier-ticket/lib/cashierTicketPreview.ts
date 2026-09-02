import type { OrderCheckoutFeeLine, OrderCheckoutPreview } from "../../checkout/lib/orderCheckoutPreview";
import { emptyOrderCheckoutPreview } from "../../checkout/lib/orderCheckoutPreview";

function asFeeLines(value: unknown): OrderCheckoutFeeLine[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const rec = row as Record<string, unknown>;
      const name = String(rec.name ?? "").trim();
      const amount = Math.round(Number(rec.amount ?? 0));
      if (!name || !Number.isFinite(amount) || amount <= 0) return null;
      const amountPercent = Number(rec.amount_percent ?? rec.amountPercent ?? 0);
      return {
        name,
        amount,
        amount_percent: Number.isFinite(amountPercent) ? amountPercent : undefined,
      };
    })
    .filter((row): row is OrderCheckoutFeeLine => Boolean(row));
}

export function parseCashierTicketPreview(args: {
  checkoutTotals: unknown;
  fallbackSubtotal: number;
  fallbackGrandTotal: number;
}): OrderCheckoutPreview {
  const fallback = emptyOrderCheckoutPreview(args.fallbackSubtotal);
  if (!args.checkoutTotals || typeof args.checkoutTotals !== "object") {
    return { ...fallback, grandTotal: args.fallbackGrandTotal || fallback.grandTotal };
  }
  const row = args.checkoutTotals as Record<string, unknown>;
  const taxLines = asFeeLines(row.taxLines);
  const gratuityLines = asFeeLines(row.gratuityLines);
  const subtotal = Math.round(Number(row.subtotal ?? args.fallbackSubtotal)) || args.fallbackSubtotal;
  const taxTotal =
    Math.round(Number(row.taxTotal ?? 0)) || taxLines.reduce((sum, line) => sum + line.amount, 0);
  const gratuityTotal =
    Math.round(Number(row.gratuityTotal ?? 0)) ||
    gratuityLines.reduce((sum, line) => sum + line.amount, 0);
  const grandTotal =
    Math.round(Number(row.grandTotal ?? args.fallbackGrandTotal)) ||
    subtotal + taxTotal + gratuityTotal;

  return {
    ok: true,
    subtotal,
    taxBase: Number(row.taxBase ?? subtotal),
    taxLines,
    gratuityLines,
    taxTotal,
    gratuityTotal,
    grandTotal,
    applicationMethod: typeof row.applicationMethod === "string" ? row.applicationMethod : undefined,
  };
}
