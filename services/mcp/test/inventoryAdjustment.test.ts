import { readFileSync } from "node:fs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { createStockAdjustment, previewStockAdjustment } from "../src/db/inventoryAdjustment";
import { MCP_SERVER_INSTRUCTIONS } from "../src/mcp/instructions";
import { MCP_TOOLS } from "../src/mcp/registry";
import { signConfirmation, verifyConfirmation } from "../src/tools/inventory/confirmation";
import {
  adjustmentInputFromConfirmation,
  adjustmentPreviewArgs,
  adjustmentPreviewInput,
  adjustmentWriteFromPreview,
} from "../src/tools/inventory/adjustmentCreate";

const migration = (name: string) =>
  readFileSync(new URL(`../../../supabase/migrations/${name}`, import.meta.url), "utf8");
const mcpSql = migration("20261109160000_mcp_stock_adjustment.sql");
const lockSql = migration("20261109170000_lock_stock_adjustment_rpc.sql");

const secret = "test-secret-at-least-sixteen-chars";
const me = { userId: "user-1", organizationId: "org-1" };
const outletId = "b9b1e2ef-1a3b-4f0a-8b47-fc0bf1fa6737";
const ingredientId = "20c2232c-52dd-43bc-905f-e6a0851c2d7d";

const base = { outlet_id: outletId, item: "Nasi", reason: "stock opname" };

describe("inventory.adjustment.preview input", () => {
  it("needs a reason and exactly one of set_to or change", () => {
    expect(adjustmentPreviewInput.safeParse({ ...base, set_to: 20 }).success).toBe(true);
    expect(adjustmentPreviewInput.safeParse({ ...base, change: -2 }).success).toBe(true);
    expect(adjustmentPreviewInput.safeParse({ ...base, set_to: 0 }).success).toBe(true);
    expect(adjustmentPreviewInput.safeParse(base).success).toBe(false);
    expect(adjustmentPreviewInput.safeParse({ ...base, set_to: 20, change: 1 }).success).toBe(false);
    expect(adjustmentPreviewInput.safeParse({ ...base, change: 0 }).success).toBe(false);
    expect(adjustmentPreviewInput.safeParse({ ...base, set_to: -1 }).success).toBe(false);
    expect(adjustmentPreviewInput.safeParse({ ...base, set_to: 1.2345 }).success).toBe(false);
    expect(adjustmentPreviewInput.safeParse({ outlet_id: outletId, item: "Nasi", set_to: 20 }).success).toBe(false);
    expect(adjustmentPreviewInput.safeParse({ ...base, reason: "  ", set_to: 20 }).success).toBe(false);
    expect(adjustmentPreviewInput.safeParse({ ...base, set_to: 20, organization_id: outletId }).success).toBe(false);
  });

  it("maps to preview args", () => {
    const parsed = adjustmentPreviewInput.parse({ ...base, item: " Nasi ", change: -2 });
    expect(adjustmentPreviewArgs(parsed)).toEqual({
      outletId, item: "Nasi", setTo: null, change: -2, reason: "stock opname",
    });
  });
});

describe("adjustment confirmation", () => {
  it("carries the resolved item and the stock the user saw", async () => {
    const write = adjustmentWriteFromPreview({
      outlet_id: outletId,
      kind: "ingredient",
      product_id: null,
      variant_id: null,
      ingredient_id: ingredientId,
      qty_before: 22,
      qty_change: -2,
    }, "stock opname");
    expect(write).toEqual({
      outletId, kind: "ingredient", productId: null, variantId: null, ingredientId,
      qtyBefore: 22, qtyChange: -2, reason: "stock opname",
    });
    const signed = await signConfirmation(secret, me, "inventory.adjustment.create", { ...write });
    const verified = await verifyConfirmation(secret, me, "inventory.adjustment.create", signed.confirm_token);
    expect(adjustmentInputFromConfirmation(verified.payload)).toEqual(write);
    await expect(
      verifyConfirmation(secret, me, "inventory.purchase_order.receive", signed.confirm_token),
    ).rejects.toThrow("confirmation_invalid");
    expect(() => adjustmentInputFromConfirmation({ ...write, qtyChange: 0 })).toThrow("confirmation_invalid");
    expect(() => adjustmentInputFromConfirmation({ ...write, ingredientId: null })).toThrow("confirmation_invalid");
    expect(() => adjustmentInputFromConfirmation({ ...write, reason: "" })).toThrow("confirmation_invalid");
  });
});

describe("adjustment db calls", () => {
  it("previews and saves with the session organization", async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: { outlet_id: outletId, kind: "ingredient", ingredient_id: ingredientId, qty_before: 22, qty_change: -2 }, error: null })
      .mockResolvedValueOnce({ data: { saved: true, qty_after: 20 }, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: 'duplicate key value violates unique constraint "mcp_tool_confirmations_pkey"' } })
      .mockResolvedValueOnce({ data: null, error: { message: "catalog_adjustment_stock_changed" } })
      .mockResolvedValueOnce({ data: null, error: { message: "catalog_adjustment_forbidden" } })
      .mockResolvedValueOnce({ data: null, error: { message: "ambiguous: Nasi | Nasi Goreng" } });
    const admin = { rpc } as unknown as SupabaseClient;

    const preview = await previewStockAdjustment(admin, me, { outletId, item: "nasi", setTo: 20, change: null, reason: "opname" });
    expect(preview.saved).toBe(false);
    expect(rpc.mock.calls[0]).toEqual([
      "mcp_preview_stock_adjustment",
      { p_user_id: "user-1", p_organization_id: "org-1", p_outlet_id: outletId, p_search: "nasi", p_set_to: 20, p_change: null, p_reason: "opname" },
    ]);

    const write = {
      outletId, kind: "ingredient" as const, productId: null, variantId: null, ingredientId,
      qtyBefore: 22, qtyChange: -2, reason: "opname",
    };
    const saved = await createStockAdjustment(admin, me, write, "c-1");
    expect(saved.saved).toBe(true);
    expect(rpc.mock.calls[1]?.[0]).toBe("mcp_confirm_stock_adjustment");
    expect(rpc.mock.calls[1]?.[1]).toMatchObject({ p_confirm_id: "c-1", p_organization_id: "org-1", p_qty_before: 22, p_qty_change: -2 });

    await expect(createStockAdjustment(admin, me, write, "c-1")).rejects.toThrow("confirmation_used");
    await expect(createStockAdjustment(admin, me, write, "c-2")).rejects.toThrow("catalog_adjustment_stock_changed");
    await expect(createStockAdjustment(admin, me, write, "c-3")).rejects.toThrow("catalog_adjustment_forbidden");
    await expect(previewStockAdjustment(admin, me, { outletId, item: "nasi", setTo: 1, change: null, reason: "x" }))
      .rejects.toThrow("ambiguous: Nasi | Nasi Goreng");
  });
});

describe("registry and SQL", () => {
  it("only create writes; both need commerce:write on the Inventory page", () => {
    const byName = new Map(MCP_TOOLS.map((tool) => [tool.name, tool]));
    expect(byName.get("inventory.adjustment.preview")?.mutates).toBeUndefined();
    expect(byName.get("inventory.adjustment.create")?.mutates).toBe(true);
    for (const name of ["inventory.adjustment.preview", "inventory.adjustment.create"] as const) {
      expect(byName.get(name)?.scopes).toEqual(["commerce:write"]);
      expect(byName.get(name)?.pagePath).toBe("/operations/sales/stock-management");
    }
    expect(MCP_SERVER_INSTRUCTIONS).toContain("inventory.adjustment.preview");
  });

  it("MCP functions check role, reason and stale stock, and are service-role only", () => {
    expect(mcpSql).toContain("public.catalog_can_adjust_stock(p_user_id, p_organization_id)");
    expect(mcpSql).toContain("RAISE EXCEPTION 'catalog_adjustment_stock_changed'");
    expect(mcpSql).toContain("'inventory.adjustment.create'");
    expect(mcpSql).toContain("'inventory_adjustment', p_confirm_id::text");
    expect(mcpSql).toContain("GRANT EXECUTE ON FUNCTION %s TO service_role");
    expect(mcpSql).not.toMatch(/GRANT EXECUTE ON FUNCTION public\.mcp_[a-z_]+\([^)]*\) TO [^;]*authenticated/);
  });

  it("app RPC: adjustment needs Owner/Admin and a reason; anon closed", () => {
    expect(lockSql).toContain("IF p_movement_type = 'adjustment' THEN");
    expect(lockSql).toContain("public.catalog_can_adjust_stock(auth.uid(), p_organization_id)");
    expect(lockSql).toContain("RAISE EXCEPTION 'catalog_adjustment_reason_required'");
    expect(lockSql).toContain("FROM PUBLIC, anon;");
    expect(lockSql).not.toMatch(/TO[^;]*\banon\b/);
  });
});
