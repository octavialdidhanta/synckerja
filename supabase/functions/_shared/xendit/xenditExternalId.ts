export type XenditExternalKind =
  | "sap"
  | "payroll_calc"
  | "purchase_request"
  | "debt_payment"
  | "payroll_run"
  | "gateway_withdrawal"
  | "payroll_escrow"
  | "pos_qris";

const VALID_KINDS: XenditExternalKind[] = [
  "sap",
  "payroll_calc",
  "purchase_request",
  "debt_payment",
  "payroll_run",
  "gateway_withdrawal",
  "payroll_escrow",
  "pos_qris",
];

export function encodeXenditExternalId(
  kind: XenditExternalKind,
  organizationId: string,
  sourceId: string,
): string {
  return `synckerja:${organizationId}:${kind}:${sourceId}`;
}

export function decodeXenditExternalId(externalId: string): {
  organizationId: string;
  kind: XenditExternalKind;
  sourceId: string;
} | null {
  const parts = externalId.trim().split(":");
  if (parts.length !== 4 || parts[0] !== "synckerja") return null;
  const kind = parts[2] as XenditExternalKind;
  if (!VALID_KINDS.includes(kind)) return null;
  return { organizationId: parts[1], kind, sourceId: parts[3] };
}

const UUID_HEX_RE =
  /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;

function uuidToHex(uuid: string): string {
  return uuid.replace(/-/g, "").toLowerCase();
}

function hexToUuid(hex: string): string {
  const h = hex.toLowerCase();
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Xendit QR `external_id` must match `^[a-zA-Z0-9 ]+$` (no colons/hyphens). */
export function encodePosQrisQrExternalId(organizationId: string, pendingCheckoutId: string): string {
  const orgHex = uuidToHex(organizationId.trim());
  const pendingHex = uuidToHex(pendingCheckoutId.trim());
  if (orgHex.length !== 32 || pendingHex.length !== 32) {
    throw new Error("pos_qris_invalid_uuid_for_external_id");
  }
  return `posqris${orgHex}${pendingHex}`;
}

export function decodePosQrisQrExternalId(externalId: string): {
  organizationId: string;
  pendingCheckoutId: string;
} | null {
  const match = /^posqris([0-9a-f]{32})([0-9a-f]{32})$/i.exec(externalId.trim());
  if (!match) return null;
  const organizationId = hexToUuid(match[1]);
  const pendingCheckoutId = hexToUuid(match[2]);
  if (!UUID_HEX_RE.test(organizationId) || !UUID_HEX_RE.test(pendingCheckoutId)) return null;
  return { organizationId, pendingCheckoutId };
}
