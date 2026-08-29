import { describe, expect, it } from "vitest";

type XenditExternalKind =
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

function encodeXenditExternalId(
  kind: XenditExternalKind,
  organizationId: string,
  sourceId: string,
): string {
  return `synckerja:${organizationId}:${kind}:${sourceId}`;
}

function decodeXenditExternalId(externalId: string): {
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

function encodePosQrisQrExternalId(organizationId: string, pendingCheckoutId: string): string {
  const orgHex = organizationId.replace(/-/g, "").toLowerCase();
  const pendingHex = pendingCheckoutId.replace(/-/g, "").toLowerCase();
  return `posqris${orgHex}${pendingHex}`;
}

function decodePosQrisQrExternalId(externalId: string): {
  organizationId: string;
  pendingCheckoutId: string;
} | null {
  const match = /^posqris([0-9a-f]{32})([0-9a-f]{32})$/i.exec(externalId.trim());
  if (!match) return null;
  const hexToUuid = (hex: string) =>
    `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  return {
    organizationId: hexToUuid(match[1]),
    pendingCheckoutId: hexToUuid(match[2]),
  };
}

describe("xenditExternalId pos_qris", () => {
  it("encodes and decodes pos_qris external ids", () => {
    const orgId = "11111111-1111-1111-1111-111111111111";
    const pendingId = "22222222-2222-2222-2222-222222222222";
    const externalId = encodeXenditExternalId("pos_qris", orgId, pendingId);
    expect(externalId).toBe(`synckerja:${orgId}:pos_qris:${pendingId}`);
    expect(decodeXenditExternalId(externalId)).toEqual({
      organizationId: orgId,
      kind: "pos_qris",
      sourceId: pendingId,
    });
  });

  it("encodes QR external_id with alphanumeric-only format", () => {
    const orgId = "11111111-1111-1111-1111-111111111111";
    const pendingId = "22222222-2222-2222-2222-222222222222";
    const externalId = encodePosQrisQrExternalId(orgId, pendingId);
    expect(externalId).toBe(
      "posqris1111111111111111111111111111111122222222222222222222222222222222",
    );
    expect(externalId).toMatch(/^[a-zA-Z0-9]+$/);
    expect(decodePosQrisQrExternalId(externalId)).toEqual({
      organizationId: orgId,
      pendingCheckoutId: pendingId,
    });
  });
});
