import { readFileSync } from "node:fs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import {
  listOpenPurchaseOrders,
  previewReceivePurchaseOrder,
  receivePurchaseOrder,
} from "../src/db/inventoryPurchaseOrderReceive";
import { MCP_SERVER_INSTRUCTIONS } from "../src/mcp/instructions";
import { MCP_TOOLS } from "../src/mcp/registry";
import { signConfirmation, verifyConfirmation } from "../src/tools/inventory/confirmation";
import {
  openPurchaseOrdersInput,
  receiveInputFromConfirmation,
  receivePreviewArgs,
  receivePreviewInput,
} from "../src/tools/inventory/purchaseOrderReceive";

const sql = readFileSync(
  new URL("../../../supabase/migrations/20261109150000_mcp_receive_purchase_order.sql", import.meta.url),
  "utf8",
);

const secret = "test-secret-at-least-sixteen-chars";
const me = { userId: "user-1", organizationId: "org-1" };
const poId = "9851f30c-d223-4b6e-ad4e-a5d377c6d9b9";
const outletId = "b9b1e2ef-1a3b-4f0a-8b47-fc0bf1fa6737";

describe("receive inputs", () => {
  it("needs exactly one of purchase_order_id or order_number", () => {
    expect(receivePreviewInput.safeParse({ purchase_order_id: poId }).success).toBe(true);
    expect(receivePreviewInput.safeParse({ order_number: "1794230422762" }).success).toBe(true);
    expect(receivePreviewInput.safeParse({}).success).toBe(false);
    expect(receivePreviewInput.safeParse({ purchase_order_id: poId, order_number: "1" }).success).toBe(false);
    expect(receivePreviewInput.safeParse({ purchase_order_id: "not-a-uuid" }).success).toBe(false);
    expect(receivePreviewInput.safeParse({ purchase_order_id: poId, qty: 1 }).success).toBe(false);
    expect(receivePreviewInput.safeParse({ purchase_order_id: poId, comment: "x".repeat(501) }).success).toBe(false);
    expect(openPurchaseOrdersInput.safeParse({}).success).toBe(true);
    expect(openPurchaseOrdersInput.safeParse({ outlet_id: outletId }).success).toBe(true);
    expect(openPurchaseOrdersInput.safeParse({ organization_id: outletId }).success).toBe(false);
  });

  it("maps to preview args", () => {
    const parsed = receivePreviewInput.parse({ order_number: " #17 ", comment: " datang " });
    expect(receivePreviewArgs(parsed)).toEqual({ purchaseOrderId: null, orderNumber: "#17", comment: "datang" });
  });
});

describe("receive confirmation", () => {
  it("round-trips the PO id and total, and rejects a token for another tool", async () => {
    const payload = { purchaseOrderId: poId, expectedTotal: 1000, comment: null };
    const signed = await signConfirmation(secret, me, "inventory.purchase_order.receive", payload);
    const verified = await verifyConfirmation(secret, me, "inventory.purchase_order.receive", signed.confirm_token);
    expect(receiveInputFromConfirmation(verified.payload)).toEqual(payload);
    await expect(
      verifyConfirmation(secret, me, "inventory.purchase_order.create", signed.confirm_token),
    ).rejects.toThrow("confirmation_invalid");
    expect(() => receiveInputFromConfirmation({ purchaseOrderId: poId })).toThrow("confirmation_invalid");
    expect(() => receiveInputFromConfirmation({ ...payload, qty: 1 })).toThrow("confirmation_invalid");
  });
});

describe("receive db calls", () => {
  it("lists, previews and receives with the session organization", async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: { purchase_orders: [] }, error: null })
      .mockResolvedValueOnce({ data: { purchase_order_id: poId, can_receive: true, total_value: 1000 }, error: null })
      .mockResolvedValueOnce({ data: { purchase_order_id: poId, saved: true, status: "completed" }, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: 'duplicate key value violates unique constraint "mcp_tool_confirmations_pkey"' } })
      .mockResolvedValueOnce({ data: null, error: { message: "catalog_po_changed" } })
      .mockResolvedValueOnce({ data: null, error: { message: "catalog_po_payment_required" } })
      .mockResolvedValueOnce({ data: null, error: { message: "not_a_member" } });
    const admin = { rpc } as unknown as SupabaseClient;

    await listOpenPurchaseOrders(admin, me, null);
    expect(rpc.mock.calls[0]).toEqual([
      "mcp_list_open_purchase_orders",
      { p_user_id: "user-1", p_organization_id: "org-1", p_outlet_id: null },
    ]);

    const preview = await previewReceivePurchaseOrder(admin, me, { purchaseOrderId: poId, orderNumber: null, comment: null });
    expect(preview.saved).toBe(false);
    expect(rpc.mock.calls[1]).toEqual([
      "mcp_preview_receive_purchase_order",
      { p_user_id: "user-1", p_organization_id: "org-1", p_purchase_order_id: poId, p_order_number: null },
    ]);

    const write = { purchaseOrderId: poId, expectedTotal: 1000, comment: null };
    const saved = await receivePurchaseOrder(admin, me, write, "c-1");
    expect(saved.saved).toBe(true);
    expect(rpc.mock.calls[2]).toEqual([
      "mcp_confirm_receive_purchase_order",
      {
        p_confirm_id: "c-1",
        p_user_id: "user-1",
        p_organization_id: "org-1",
        p_purchase_order_id: poId,
        p_expected_total: 1000,
        p_comment: null,
      },
    ]);

    await expect(receivePurchaseOrder(admin, me, write, "c-1")).rejects.toThrow("confirmation_used");
    await expect(receivePurchaseOrder(admin, me, write, "c-2")).rejects.toThrow("catalog_po_changed");
    await expect(receivePurchaseOrder(admin, me, write, "c-3")).rejects.toThrow("catalog_po_payment_required");
    await expect(listOpenPurchaseOrders(admin, me, null)).rejects.toThrow("not_a_member");
  });
});

describe("registry and SQL", () => {
  it("only receive writes; list is read scope", () => {
    const byName = new Map(MCP_TOOLS.map((tool) => [tool.name, tool]));
    expect(byName.get("inventory.purchase_order.open_list")?.scopes).toEqual(["commerce:read"]);
    expect(byName.get("inventory.purchase_order.open_list")?.mutates).toBeUndefined();
    expect(byName.get("inventory.purchase_order.receive.preview")?.mutates).toBeUndefined();
    expect(byName.get("inventory.purchase_order.receive")?.mutates).toBe(true);
    for (const name of ["inventory.purchase_order.receive.preview", "inventory.purchase_order.receive"] as const) {
      expect(byName.get(name)?.scopes).toEqual(["commerce:write"]);
      expect(byName.get(name)?.pagePath).toBe("/operations/sales/stock-management");
    }
    expect(byName.get("inventory.purchase_order.receive")?.description).toContain("never save two writes on one confirmation");
    expect(MCP_SERVER_INSTRUCTIONS).toContain("inventory.purchase_order.receive.preview");
  });

  it("reuses the fulfill RPC as the session user, stores each confirmation once, and is service-role only", () => {
    expect(sql).toContain("public.fulfill_catalog_purchase_order(");
    expect(sql).toContain("INSERT INTO public.mcp_tool_confirmations");
    expect(sql).toContain("'inventory.purchase_order.receive'");
    expect(sql).toContain("set_config('request.jwt.claim.sub', p_user_id::text, true)");
    expect(sql).toContain("RAISE EXCEPTION 'catalog_po_changed'");
    expect(sql).toContain("public.user_has_inventory_feature_access(p_organization_id, 'po_fulfillment')");
    expect(sql).toContain("REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated");
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION %s TO service_role");
    expect(sql).not.toMatch(/INSERT INTO public\.expenses/);
  });
});
