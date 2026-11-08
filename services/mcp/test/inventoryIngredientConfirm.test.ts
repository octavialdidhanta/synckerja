import { readFileSync } from "node:fs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { writeCatalogIngredient } from "../src/db/inventoryIngredient";
import { MCP_TOOLS } from "../src/mcp/registry";
import {
  CONFIRMATION_TTL_SECONDS,
  signConfirmation,
  verifyConfirmation,
} from "../src/tools/inventory/confirmation";
import {
  ingredientInputFromConfirmation,
  ingredientPreviewInput,
  ingredientWriteInput,
} from "../src/tools/inventory/ingredientCreate";
import { purchaseOrderInputFromConfirmation } from "../src/tools/inventory/purchaseOrderCreate";

const sql = readFileSync(
  new URL(
    "../../../supabase/migrations/20261108180000_mcp_inventory_ingredient_create_and_confirmations.sql",
    import.meta.url,
  ),
  "utf8",
);

const secret = "test-secret-at-least-sixteen-chars";
const me = { userId: "user-1", organizationId: "org-1" };
const outletId = "9ade0045-0fc0-4545-9a3d-34866dff903a";
const valid = {
  outlet_id: outletId,
  name: "Daging Ayam",
  unit_code: "kg",
  category_name: "Daging",
  opening_stock: 10,
  unit_cost: 38000,
};

describe("inventory.ingredient.preview input", () => {
  it("requires every field instead of letting the assistant guess", () => {
    expect(ingredientPreviewInput.safeParse(valid).success).toBe(true);
    for (const field of ["outlet_id", "name", "unit_code", "category_name", "opening_stock", "unit_cost"]) {
      const rest: Record<string, unknown> = { ...valid };
      delete rest[field];
      expect(ingredientPreviewInput.safeParse(rest).success).toBe(false);
    }
  });

  it("accepts an explicit null category and zero stock without a price", () => {
    expect(ingredientPreviewInput.safeParse({ ...valid, category_name: null }).success).toBe(true);
    expect(ingredientPreviewInput.safeParse({ ...valid, opening_stock: 0, unit_cost: 0 }).success).toBe(true);
  });

  it("rejects stock without a price, unknown units, negatives, extra fields", () => {
    const noPrice = ingredientPreviewInput.safeParse({ ...valid, unit_cost: 0 });
    expect(noPrice.success).toBe(false);
    if (!noPrice.success) {
      expect(noPrice.error.issues.some((issue) => issue.message === "ingredient_cost_required")).toBe(true);
    }
    expect(ingredientPreviewInput.safeParse({ ...valid, unit_code: "kilo" }).success).toBe(false);
    expect(ingredientPreviewInput.safeParse({ ...valid, opening_stock: -1 }).success).toBe(false);
    expect(ingredientPreviewInput.safeParse({ ...valid, opening_stock: 1.2345 }).success).toBe(false);
    expect(ingredientPreviewInput.safeParse({ ...valid, organization_id: "org-2" }).success).toBe(false);
  });
});

describe("confirm token", () => {
  it("round-trips the exact previewed input", async () => {
    const input = ingredientWriteInput(ingredientPreviewInput.parse(valid));
    const signed = await signConfirmation(secret, me, "inventory.ingredient.create", { ...input });
    const verified = await verifyConfirmation(secret, me, "inventory.ingredient.create", signed.confirm_token);
    expect(ingredientInputFromConfirmation(verified.payload)).toEqual(input);
    expect(verified.confirmId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("refuses another tool, user, organization, secret, or an expired token", async () => {
    const now = new Date("2026-11-08T10:00:00Z");
    const signed = await signConfirmation(secret, me, "inventory.ingredient.create", { name: "x" }, now);
    const token = signed.confirm_token;
    await expect(verifyConfirmation(secret, me, "inventory.purchase_order.create", token, now)).rejects.toThrow("confirmation_invalid");
    await expect(verifyConfirmation(secret, { ...me, userId: "user-2" }, "inventory.ingredient.create", token, now)).rejects.toThrow("confirmation_invalid");
    await expect(verifyConfirmation(secret, { ...me, organizationId: "org-2" }, "inventory.ingredient.create", token, now)).rejects.toThrow("confirmation_invalid");
    await expect(verifyConfirmation(`${secret}-other`, me, "inventory.ingredient.create", token, now)).rejects.toThrow("confirmation_invalid");
    const later = new Date(now.getTime() + (CONFIRMATION_TTL_SECONDS + 60) * 1000);
    await expect(verifyConfirmation(secret, me, "inventory.ingredient.create", token, later)).rejects.toThrow("confirmation_expired");
  });

  it("rejects a tampered payload when rebuilding input", () => {
    expect(() => ingredientInputFromConfirmation({ name: "x" })).toThrow("confirmation_invalid");
    expect(() => purchaseOrderInputFromConfirmation({ search: "Ayam", qty: 0, unitCost: 1, outletId })).toThrow("confirmation_invalid");
  });
});

describe("ingredient write", () => {
  it("previews with a null confirm id and saves with the token id", async () => {
    const row = {
      saved: false,
      outlet_id: outletId,
      outlet_name: "Sate Sultan PIK",
      name: "Daging Ayam",
      kind: "raw",
      unit_code: "kg",
      category_name: "Daging",
      category_is_new: true,
      opening_stock: "10",
      unit_cost: "38000",
      opening_value: "380000",
      track_cogs: true,
      alert_at: null,
    };
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: row, error: null })
      .mockResolvedValueOnce({ data: { ...row, saved: true, ingredient_id: "ing-1", in_stock: 10 }, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: 'duplicate key value violates unique constraint "mcp_tool_confirmations_pkey"' } });
    const admin = { rpc } as unknown as SupabaseClient;
    const input = ingredientWriteInput(ingredientPreviewInput.parse(valid));

    const preview = await writeCatalogIngredient(admin, me, input, null);
    expect(preview.saved).toBe(false);
    expect(preview.opening_value).toBe(380000);
    expect(rpc.mock.calls[0][1].p_confirm_id).toBeNull();

    const saved = await writeCatalogIngredient(admin, me, input, "c-1");
    expect(saved.saved).toBe(true);
    expect(saved.ingredient_id).toBe("ing-1");
    expect(rpc.mock.calls[1][1]).toMatchObject({
      p_user_id: "user-1",
      p_organization_id: "org-1",
      p_name: "Daging Ayam",
      p_unit_code: "kg",
      p_category_name: "Daging",
      p_opening_stock: 10,
      p_unit_cost: 38000,
      p_confirm_id: "c-1",
    });

    await expect(writeCatalogIngredient(admin, me, input, "c-1")).rejects.toThrow("confirmation_used");
  });
});

describe("registry and SQL", () => {
  it("only the create tools write, and both need commerce:write", () => {
    const byName = new Map(MCP_TOOLS.map((tool) => [tool.name, tool]));
    expect(byName.get("inventory.ingredient.preview")?.mutates).toBeUndefined();
    expect(byName.get("inventory.purchase_order.preview")?.mutates).toBeUndefined();
    expect(byName.get("inventory.ingredient.create")?.mutates).toBe(true);
    expect(byName.get("inventory.purchase_order.create")?.mutates).toBe(true);
    for (const name of ["inventory.ingredient.preview", "inventory.ingredient.create"] as const) {
      expect(byName.get(name)?.scopes).toEqual(["commerce:write"]);
      expect(byName.get(name)?.pagePath).toBe("/operations/ingredient/list");
    }
    expect(byName.get("inventory.ingredient.preview")?.description).toContain("Never guess");
  });

  it("previews without writing and stores each confirmation once", () => {
    expect(sql).toContain("IF p_confirm_id IS NULL THEN");
    expect(sql).toContain("id uuid PRIMARY KEY");
    expect(sql).toContain("INSERT INTO public.mcp_tool_confirmations");
    expect(sql).toContain("RAISE EXCEPTION 'ingredient_duplicate'");
    expect(sql).toContain("RAISE EXCEPTION 'ingredient_cost_required'");
    expect(sql).toContain("public.apply_catalog_stock_movement(");
    expect(sql).toContain("'opening'");
    expect(sql).toContain("public.mcp_create_inventory_purchase_order(");
    expect(sql).toContain("ur.role = 'owner'::text");
    expect(sql).toContain("TO service_role");
  });
});
