import { describe, expect, it } from "vitest";
import { buildPoPurchaseRequestDescription, buildPoPurchaseRequestTitle } from "./buildPoPurchaseRequestPayload";
import { inventoryPoPurchaseType, isInventoryPurchaseType } from "./resolvePoExpenseClassification";
import {
  canCancelPurchaseOrder,
  canEditPurchaseOrder,
  canFulfillPurchaseOrder,
  canResubmitPurchaseOrder,
  derivePoFinanceStatus,
  poFinanceHref,
} from "./poFinanceStatus";

describe("derivePoFinanceStatus", () => {
  it("returns none without a linked request", () => {
    expect(derivePoFinanceStatus(null)).toBe("none");
  });

  it("treats paid_at or payment_status as paid before approval labels", () => {
    expect(
      derivePoFinanceStatus({
        id: "1",
        status: "approved",
        payment_status: "paid",
        paid_at: "2026-08-25T00:00:00.000Z",
      }),
    ).toBe("paid");
  });

  it("maps submitted and pending_approval", () => {
    expect(derivePoFinanceStatus({ id: "1", status: "submitted" })).toBe("submitted");
    expect(derivePoFinanceStatus({ id: "1", status: "pending_approval" })).toBe("submitted");
  });
});

describe("PO finance action gates", () => {
  it("locks fulfill until paid when a request exists", () => {
    expect(canFulfillPurchaseOrder("waiting", "submitted", true)).toBe(false);
    expect(canFulfillPurchaseOrder("waiting", "approved", true)).toBe(false);
    expect(canFulfillPurchaseOrder("waiting", "paid", true)).toBe(true);
  });

  it("allows fulfill for legacy POs without a request", () => {
    expect(canFulfillPurchaseOrder("waiting", "none", false)).toBe(true);
  });

  it("blocks cancel after paid and edit after approved", () => {
    expect(canCancelPurchaseOrder("waiting", "paid")).toBe(false);
    expect(canCancelPurchaseOrder("waiting", "submitted")).toBe(true);
    expect(canEditPurchaseOrder("waiting", "approved")).toBe(false);
    expect(canEditPurchaseOrder("waiting", "rejected")).toBe(true);
    expect(canResubmitPurchaseOrder("waiting", "rejected")).toBe(true);
    expect(canResubmitPurchaseOrder("waiting", "submitted")).toBe(false);
  });

  it("routes badges to the matching expenses page", () => {
    expect(poFinanceHref("submitted")).toBe("/expenses/approvals");
    expect(poFinanceHref("rejected")).toBe("/expenses/approvals");
    expect(poFinanceHref("approved")).toBe("/expenses/payment-process");
    expect(poFinanceHref("paid")).toBe("/expenses/payment-process");
    expect(poFinanceHref("none")).toBeNull();
  });
});

describe("inventory PO payload helpers", () => {
  it("builds title and description from note, outlet, and lines", () => {
    expect(buildPoPurchaseRequestTitle("#1787833377945", "Outlet 1")).toBe(
      "PO #1787833377945 — Outlet 1",
    );
    expect(
      buildPoPurchaseRequestDescription({
        note: "Telur ayam yang bagus bagus",
        outletName: "Outlet 1",
        lines: [{ nameSnapshot: "Telur", qty: 500, unitCost: 2500 }],
      }),
    ).toBe("Telur ayam yang bagus bagus\n\nOutlet: Outlet 1\n\nTelur × 500 @ Rp 2.500");
  });

  it("uses Inventory purchase types that are not Physical Item", () => {
    expect(inventoryPoPurchaseType("ingredient")).toBe("Inventory");
    expect(inventoryPoPurchaseType("product")).toBe("Inventory Item");
    expect(isInventoryPurchaseType("Physical Item")).toBe(false);
    expect(isInventoryPurchaseType("Inventory")).toBe(true);
    expect(isInventoryPurchaseType("Inventory Item")).toBe(true);
  });
});
