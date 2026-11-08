import { readFileSync } from "node:fs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { createInventoryPurchaseOrder } from "../src/db/inventoryPurchaseOrder";
import { MCP_TOOLS } from "../src/mcp/registry";
import { purchaseOrderInput } from "../src/tools/inventory/purchaseOrderCreate";

const sql = readFileSync(
  new URL("../../../supabase/migrations/20261108170000_mcp_create_inventory_purchase_order.sql", import.meta.url),
  "utf8",
);

const outletId = "9ade0045-0fc0-4545-9a3d-34866dff903a";
const confirmId = "6f1c2a7e-3d4b-4c5a-9e8f-0a1b2c3d4e5f";

const input = {
  outlet_id: outletId,
  search: "Ayam",
  qty: 100,
  unit_cost: 25000,
};

describe("inventory.purchase_order.create input", () => {
  it("requires a price and rejects a foreign organization", () => {
    expect(purchaseOrderInput.safeParse(input).success).toBe(true);
    expect(purchaseOrderInput.safeParse({ ...input, unit_cost: undefined }).success).toBe(false);
    expect(purchaseOrderInput.safeParse({ ...input, unit_cost: 0 }).success).toBe(false);
    expect(purchaseOrderInput.safeParse({ ...input, qty: 0 }).success).toBe(false);
    expect(purchaseOrderInput.safeParse({ ...input, qty: 1.2345 }).success).toBe(false);
    expect(purchaseOrderInput.safeParse({ ...input, qty: 0.001, unit_cost: 0.4 }).success).toBe(false);
    expect(purchaseOrderInput.safeParse({
      ...input,
      organization_id: "5fa70166-0a35-4f0d-94b3-54f19b3f8c30",
    }).success).toBe(false);
  });
});

describe("mcp_create_inventory_purchase_order", () => {
  it("keeps the page role, the session user, and the organization mode", () => {
    expect(sql).toContain("ur.role = 'owner'::text");
    expect(sql).toContain("public.organization_omnichannel_staff");
    expect(sql).toContain("staff.role = 'admin'::text");
    expect(sql).toContain("RAISE EXCEPTION 'not_a_member'");
    expect(sql).toContain("RAISE EXCEPTION 'forbidden'");
    expect(sql).toContain("set_config('request.jwt.claim.sub', p_user_id::text, true)");
    expect(sql).toContain("set_config('request.jwt.claim.role', 'authenticated', true)");
    expect(sql).toContain("v_fulfill := v_po_mode IS DISTINCT FROM 'advanced'");
    expect(sql).toContain("public.create_catalog_purchase_order(");
    expect(sql).toContain("v_fulfill");
    expect(sql).toContain("IF v_status IS DISTINCT FROM 'completed' THEN");
    expect(sql).toContain("v_qty_after := v_qty_before");
    expect(sql).toContain("'ambiguous: '");
    expect(sql).toContain("AND NOT EXISTS (");
    expect(sql).toContain("lower(btrim(variant.name)) = lower(v_search)");
    expect(sql).toContain("outlet.organization_id = p_organization_id");
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.mcp_create_inventory_purchase_order(uuid, uuid, uuid, text, numeric, numeric, uuid, text) TO service_role");
    const tool = readFileSync(new URL("../src/tools/inventory/purchaseOrderCreate.ts", import.meta.url), "utf8");
    const reader = readFileSync(new URL("../src/db/inventoryPurchaseOrder.ts", import.meta.url), "utf8");
    for (const source of [tool, reader]) {
      expect(source).not.toContain("createAdmin");
      expect(source).not.toContain("SERVICE_ROLE");
      expect(source).not.toContain("active_organization_id");
    }
  });
});

describe("purchase order receipt", () => {
  it("calls the session organization and reports whether stock was received", async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({
        data: {
          purchase_order_id: "po-1",
          order_number: "#100",
          status: "completed",
          po_mode: "simple",
          stock_received: true,
          outlet_id: outletId,
          outlet_name: "Outlet 1",
          kind: "ingredient",
          name: "Ayam",
          variant_name: null,
          qty_added: 100,
          unit_cost: 25000,
          qty_before: 5,
          qty_after: 105,
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          purchase_order_id: "po-2",
          order_number: "#101",
          status: "waiting",
          po_mode: "advanced",
          stock_received: false,
          outlet_id: outletId,
          outlet_name: "Outlet 1",
          kind: "ingredient",
          name: "Ayam",
          variant_name: null,
          qty_added: "100",
          unit_cost: "25000",
          qty_before: 5,
          qty_after: 5,
        },
        error: null,
      });
    const admin = { rpc } as unknown as SupabaseClient;
    const args = {
      outletId,
      search: "Ayam",
      qty: 100,
      unitCost: 25000,
      supplierId: null,
      note: null,
    };
    const received = await createInventoryPurchaseOrder(admin, {
      userId: "user-1",
      organizationId: "org-1",
    }, args, confirmId);
    const waiting = await createInventoryPurchaseOrder(admin, {
      userId: "user-1",
      organizationId: "org-1",
    }, args, confirmId);
    expect(rpc).toHaveBeenCalledWith("mcp_confirm_inventory_purchase_order", {
      p_confirm_id: confirmId,
      p_user_id: "user-1",
      p_organization_id: "org-1",
      p_outlet_id: outletId,
      p_search: "Ayam",
      p_qty: 100,
      p_unit_cost: 25000,
      p_supplier_id: null,
      p_note: null,
    });
    const sent = JSON.stringify(rpc.mock.calls);
    expect(sent).not.toContain("org-2");
    expect(sent).not.toContain("access_token");
    expect(received.stock_received).toBe(true);
    expect(received.qty_after).toBe(105);
    expect(waiting.po_mode).toBe("advanced");
    expect(waiting.stock_received).toBe(false);
    expect(waiting.qty_after).toBe(waiting.qty_before);
    expect(MCP_TOOLS.find((tool) => tool.name === "inventory.purchase_order.create")?.mutates).toBe(true);
  });

  it("maps another member and a non-manager without hiding a purchase-order refusal", async () => {
    const member = {
      rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "not_a_member" } }),
    } as unknown as SupabaseClient;
    const manager = {
      rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "forbidden" } }),
    } as unknown as SupabaseClient;
    const feature = {
      rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "catalog_inventory_feature_forbidden" } }),
    } as unknown as SupabaseClient;
    const otherOrgOutlet = {
      rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "catalog_po_forbidden" } }),
    } as unknown as SupabaseClient;
    const args = {
      outletId,
      search: "Ayam",
      qty: 100,
      unitCost: 25000,
      supplierId: null,
      note: null,
    };
    await expect(createInventoryPurchaseOrder(member, {
      userId: "outsider",
      organizationId: "org-1",
    }, args, confirmId)).rejects.toThrow("not_a_member");
    await expect(createInventoryPurchaseOrder(manager, {
      userId: "user-1",
      organizationId: "org-1",
    }, args, confirmId)).rejects.toThrow("forbidden");
    await expect(createInventoryPurchaseOrder(feature, {
      userId: "user-1",
      organizationId: "org-1",
    }, args, confirmId)).rejects.toThrow("catalog_inventory_feature_forbidden");
    await expect(createInventoryPurchaseOrder(otherOrgOutlet, {
      userId: "user-1",
      organizationId: "org-1",
    }, args, confirmId)).rejects.toThrow("catalog_po_forbidden");
  });
});
