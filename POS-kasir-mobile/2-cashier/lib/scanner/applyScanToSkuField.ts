import { parsePosScanPayload } from "./parsePosScanPayload";

/**
 * Map a camera/wedge scan into a catalog SKU string for Create Item.
 * Guest QR payloads are ignored (never write SYNK tokens into SKU).
 */
export function applyScanToSkuField(raw: string): string | null {
  const parsed = parsePosScanPayload(raw);
  if (!parsed) return null;
  if (parsed.kind === "guest_qr") return null;
  const code = parsed.code.trim();
  return code.length > 0 ? code : null;
}
