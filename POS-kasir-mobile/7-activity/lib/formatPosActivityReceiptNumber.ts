import { formatStoreReceiptNumber } from "@/5-2-customer-visits/checkout/lib/formatStoreReceiptNumber";

/** POS Activity receipt number (SC-XXXXXXXX). */
export function formatPosActivityReceiptNumber(
  activityId: string | null | undefined,
): string {
  return formatStoreReceiptNumber(activityId);
}

/** Normalize search needle for matching SC- codes / UUID fragments. */
export function normalizePosActivitySearchNeedle(raw: string): string {
  return raw.trim().toLowerCase().replace(/^sc-/, "").replace(/-/g, "");
}
