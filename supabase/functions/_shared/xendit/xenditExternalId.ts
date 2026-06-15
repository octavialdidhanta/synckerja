export type XenditExternalKind =
  | "sap"
  | "payroll_calc"
  | "purchase_request"
  | "debt_payment"
  | "payroll_run"
  | "gateway_withdrawal";

const VALID_KINDS: XenditExternalKind[] = [
  "sap",
  "payroll_calc",
  "purchase_request",
  "debt_payment",
  "payroll_run",
  "gateway_withdrawal",
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
