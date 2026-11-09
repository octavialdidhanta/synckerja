import { readFileSync } from "node:fs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { createIngredientProduction, previewIngredientProduction } from "../src/db/inventoryProduction";
import { MCP_SERVER_INSTRUCTIONS } from "../src/mcp/instructions";
import { MCP_TOOLS } from "../src/mcp/registry";
import { signConfirmation, verifyConfirmation } from "../src/tools/inventory/confirmation";
import {
  productionInputFromConfirmation,
  productionPreviewArgs,
  productionPreviewInput,
} from "../src/tools/inventory/productionCreate";

const migration = (name: string) =>
  readFileSync(new URL(`../../../supabase/migrations/${name}`, import.meta.url), "utf8");
const mcpSql = migration("20261109101000_mcp_ingredient_production.sql");
const hardenSql = migration("20261109100000_harden_ingredient_produce.sql");

const secret = "test-secret-at-least-sixteen-chars";
const me = { userId: "user-1", organizationId: "org-1" };
const outletId = "b9b1e2ef-1a3b-4f0a-8b47-fc0bf1fa6737";
const itemId = "20c2232c-52dd-43bc-905f-e6a0851c2d7d";

describe("inventory.production.preview input", () => {
  it("needs outlet, item and a positive quantity", () => {
    expect(productionPreviewInput.safeParse({ outlet_id: outletId, item: "Nasi", qty: 20 }).success).toBe(true);
    expect(productionPreviewInput.safeParse({ outlet_id: outletId, item: "Nasi" }).success).toBe(false);
    expect(productionPreviewInput.safeParse({ outlet_id: outletId, qty: 20 }).success).toBe(false);
    expect(productionPreviewInput.safeParse({ item: "Nasi", qty: 20 }).success).toBe(false);
    expect(productionPreviewInput.safeParse({ outlet_id: outletId, item: "Nasi", qty: 0 }).success).toBe(false);
    expect(productionPreviewInput.safeParse({ outlet_id: outletId, item: "Nasi", qty: -1 }).success).toBe(false);
    expect(productionPreviewInput.safeParse({ outlet_id: outletId, item: "Nasi", qty: 1.2345 }).success).toBe(false);
    expect(productionPreviewInput.safeParse({ outlet_id: outletId, item: "Nasi", qty: 2, extra: 1 }).success).toBe(false);
  });

  it("maps to the preview args", () => {
    const parsed = productionPreviewInput.parse({ outlet_id: outletId, item: " Nasi ", qty: 20 });
    expect(productionPreviewArgs(parsed)).toEqual({ outletId, item: "Nasi", qty: 20 });
  });
});

describe("production confirmation", () => {
  it("round-trips the resolved item id and rejects a tampered payload", async () => {
    const payload = { outletId, itemId, qty: 20 };
    const signed = await signConfirmation(secret, me, "inventory.production.create", payload);
    const verified = await verifyConfirmation(secret, me, "inventory.production.create", signed.confirm_token);
    expect(productionInputFromConfirmation(verified.payload)).toEqual(payload);
    await expect(
      verifyConfirmation(secret, me, "inventory.ingredient.create", signed.confirm_token),
    ).rejects.toThrow("confirmation_invalid");
    expect(() => productionInputFromConfirmation({ outletId, item: "Nasi", qty: 20 })).toThrow("confirmation_invalid");
    expect(() => productionInputFromConfirmation({ outletId, itemId, qty: 0 })).toThrow("confirmation_invalid");
  });
});

describe("production db calls", () => {
  it("previews read-only and confirms with the token id", async () => {
    const preview = {
      outlet_id: outletId,
      outlet_name: "Taman Cibodas",
      item_id: itemId,
      item: "Nasi",
      qty: 20,
      can_produce: true,
      lines: [{ ingredient: "Beras", need: 2, stock_before: 9, stock_after: 7, enough: true }],
    };
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: preview, error: null })
      .mockResolvedValueOnce({ data: { saved: true, item_id: itemId, qty: 20, stock_after: 20 }, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: 'duplicate key value violates unique constraint "mcp_tool_confirmations_pkey"' } })
      .mockResolvedValueOnce({ data: null, error: { message: "catalog_stock_insufficient" } })
      .mockResolvedValueOnce({ data: null, error: { message: "ambiguous: Nasi Goreng | Nasi Putih" } });
    const admin = { rpc } as unknown as SupabaseClient;

    const shown = await previewIngredientProduction(admin, me, { outletId, item: "nasi", qty: 20 });
    expect(shown.saved).toBe(false);
    expect(rpc.mock.calls[0]).toEqual([
      "mcp_preview_ingredient_production",
      { p_user_id: "user-1", p_organization_id: "org-1", p_outlet_id: outletId, p_search: "nasi", p_qty: 20 },
    ]);

    const saved = await createIngredientProduction(admin, me, { outletId, itemId, qty: 20 }, "c-1");
    expect(saved.saved).toBe(true);
    expect(rpc.mock.calls[1]).toEqual([
      "mcp_confirm_ingredient_production",
      { p_confirm_id: "c-1", p_user_id: "user-1", p_organization_id: "org-1", p_outlet_id: outletId, p_item_id: itemId, p_qty: 20 },
    ]);

    await expect(createIngredientProduction(admin, me, { outletId, itemId, qty: 20 }, "c-1")).rejects.toThrow("confirmation_used");
    await expect(createIngredientProduction(admin, me, { outletId, itemId, qty: 999 }, "c-2")).rejects.toThrow("catalog_stock_insufficient");
    await expect(previewIngredientProduction(admin, me, { outletId, item: "nasi", qty: 1 })).rejects.toThrow("ambiguous: Nasi Goreng | Nasi Putih");
  });
});

describe("registry and SQL", () => {
  it("only create writes; both need commerce:write on the Ingredient page", () => {
    const byName = new Map(MCP_TOOLS.map((tool) => [tool.name, tool]));
    expect(byName.get("inventory.production.preview")?.mutates).toBeUndefined();
    expect(byName.get("inventory.production.create")?.mutates).toBe(true);
    for (const name of ["inventory.production.preview", "inventory.production.create"] as const) {
      expect(byName.get(name)?.scopes).toEqual(["commerce:write"]);
      expect(byName.get(name)?.pagePath).toBe("/operations/ingredient/list");
    }
    expect(byName.get("inventory.production.preview")?.description).toContain("Never guess");
    expect(byName.get("inventory.production.create")?.description).toContain("never save two writes on one confirmation");
    expect(MCP_SERVER_INSTRUCTIONS).toContain("inventory.production.preview");
  });

  it("reuses the Produce RPC, stores each confirmation once, and keeps service-role only grants", () => {
    expect(mcpSql).toContain("public.apply_catalog_ingredient_produce(");
    expect(mcpSql).toContain("INSERT INTO public.mcp_tool_confirmations");
    expect(mcpSql).toContain("'inventory.production.create'");
    expect(mcpSql).toContain("mcp_inventory_manager_guard(p_user_id, p_organization_id)");
    expect(mcpSql).not.toMatch(/GRANT EXECUTE ON FUNCTION public\.mcp_[a-z_]+\([^)]*\) TO [^;]*authenticated/);
  });

  it("produce RPC checks the outlet and is closed to anon", () => {
    expect(hardenSql).toContain("FROM public.pos_outlets o");
    expect(hardenSql).toContain("REVOKE ALL ON FUNCTION public.apply_catalog_ingredient_produce(uuid, uuid, uuid, numeric, text) FROM PUBLIC, anon;");
    expect(hardenSql).not.toMatch(/TO[^;]*\banon\b/);
  });
});
