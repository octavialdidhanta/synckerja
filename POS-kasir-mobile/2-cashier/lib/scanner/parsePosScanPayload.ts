import { parseCashierQrPayload } from "@/synckerja-order/0-storefront/cashier-ticket/lib/buildCashierQrPayload";

export type PosScanPayload =
  | { kind: "guest_qr"; token: string }
  | { kind: "product"; code: string };

/** Classify a wedge/camera scan string as guest claim QR or product code. */
export function parsePosScanPayload(raw: string): PosScanPayload | null {
  const text = raw.trim();
  if (!text) return null;
  const guestToken = parseCashierQrPayload(text);
  if (guestToken) return { kind: "guest_qr", token: guestToken };
  return { kind: "product", code: text };
}

/** Bare claim tokens without SYNK: prefix (legacy wedge). */
export function tryParseBareGuestClaimToken(raw: string): string | null {
  return parseCashierQrPayload(`SYNK:${raw.trim()}`);
}
