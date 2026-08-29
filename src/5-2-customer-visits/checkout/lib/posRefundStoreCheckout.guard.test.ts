import { describe, expect, it } from "vitest";

/**
 * Soft-refund RPC guard semantics (client-facing): second refund on same activity must fail.
 * Mirrors messages raised by pos_refund_store_checkout.
 */
function softRefundGuard(status: "none" | "full"): { ok: boolean; code?: string } {
  if (status === "full") return { ok: false, code: "already_refunded" };
  return { ok: true };
}

describe("pos soft-refund idempotency", () => {
  it("allows first refund when status is none", () => {
    expect(softRefundGuard("none")).toEqual({ ok: true });
  });

  it("rejects second refund when status is already full", () => {
    expect(softRefundGuard("full")).toEqual({ ok: false, code: "already_refunded" });
  });
});
