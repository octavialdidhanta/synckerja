export type SynckerjaExternalKind = "sap" | "payroll_calc" | "purchase_request" | "debt_payment" | "payroll_run";

export function encodeSynckerjaExternalId(
  kind: SynckerjaExternalKind,
  organizationId: string,
  sourceId: string,
): string {
  return `synckerja:${organizationId}:${kind}:${sourceId}`;
}

export function decodeSynckerjaExternalId(externalId: string): {
  organizationId: string;
  kind: SynckerjaExternalKind;
  sourceId: string;
} | null {
  const parts = externalId.trim().split(":");
  if (parts.length !== 4 || parts[0] !== "synckerja") return null;
  const kind = parts[2] as SynckerjaExternalKind;
  if (!["sap", "payroll_calc", "purchase_request", "debt_payment", "payroll_run"].includes(kind)) {
    return null;
  }
  return { organizationId: parts[1], kind, sourceId: parts[3] };
}
