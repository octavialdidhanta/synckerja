import { kitchenWasteNote } from "@/stock-management/stock-commit/lib/kitchenWaste";
import type { RefundStockPolicy } from "./resolveRefundStockPolicy";

/** Ledger reason stored on the sales refund. Waste is prefixed; restore stays raw. */
export function formatRefundLedgerReason(
  policy: RefundStockPolicy,
  reason: string | null | undefined,
): string | null {
  const trimmed = (reason ?? "").trim();
  if (!trimmed) return null;
  if (policy === "waste") return kitchenWasteNote(trimmed);
  return trimmed;
}
