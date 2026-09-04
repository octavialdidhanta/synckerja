import { describe, expect, it } from "vitest";
import type { PosKitchenTicketStatus } from "@/pos-mobile/8-kitchen/lib/posKitchenTypes";
import {
  assertRefundWasteReason,
  isRefundWasteReasonValid,
  POS_REFUND_WASTE_REASON_REQUIRED,
  resolveRefundStockPolicy,
  canConfirmPosCheckoutRefund,
} from "./resolveRefundStockPolicy";

function tickets(...statuses: PosKitchenTicketStatus[]) {
  return statuses.map((status) => ({ status }));
}

describe("resolveRefundStockPolicy", () => {
  it("restores when there are no tickets", () => {
    expect(resolveRefundStockPolicy([])).toBe("restore");
  });

  it("restores when every live ticket is still new", () => {
    expect(resolveRefundStockPolicy(tickets("new", "new"))).toBe("restore");
  });

  it("restores when tickets are only void (treat like retail / already cleared)", () => {
    expect(resolveRefundStockPolicy(tickets("void", "void"))).toBe("restore");
  });

  it("ignores void tickets when remaining tickets are still new", () => {
    expect(resolveRefundStockPolicy(tickets("void", "new"))).toBe("restore");
  });

  it.each(["in_progress", "ready", "done"] as const)(
    "wastes when any ticket is %s",
    (status) => {
      expect(resolveRefundStockPolicy(tickets("new", status))).toBe("waste");
    },
  );

  it("wastes mixed F&B + retail when any kitchen ticket has started", () => {
    expect(resolveRefundStockPolicy(tickets("new", "in_progress", "void"))).toBe(
      "waste",
    );
  });
});

describe("assertRefundWasteReason", () => {
  it("canConfirmPosCheckoutRefund blocks waste without a reason", () => {
    expect(
      canConfirmPosCheckoutRefund({ policy: "waste", reason: "" }),
    ).toBe(false);
    expect(
      canConfirmPosCheckoutRefund({ policy: "waste", reason: "ok!" }),
    ).toBe(true);
    expect(
      canConfirmPosCheckoutRefund({ policy: "restore", reason: "" }),
    ).toBe(true);
    expect(
      canConfirmPosCheckoutRefund({
        policy: "restore",
        policyLoading: true,
        reason: "",
      }),
    ).toBe(false);
  });

  it("allows restore without a reason", () => {
    expect(() => assertRefundWasteReason("restore", null)).not.toThrow();
    expect(() => assertRefundWasteReason("restore", "  ")).not.toThrow();
  });

  it("requires at least 3 trimmed characters for waste", () => {
    expect(isRefundWasteReasonValid("ab")).toBe(false);
    expect(isRefundWasteReasonValid("  ok  ")).toBe(false);
    expect(isRefundWasteReasonValid("  ok!  ")).toBe(true);
    expect(() => assertRefundWasteReason("waste", "no")).toThrow(
      POS_REFUND_WASTE_REASON_REQUIRED,
    );
    expect(() => assertRefundWasteReason("waste", "guest left")).not.toThrow();
  });
});
