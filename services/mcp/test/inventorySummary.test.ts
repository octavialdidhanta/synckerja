import { readFileSync } from "node:fs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { listInventorySummary } from "../src/db/inventorySummary";
import { summaryColumns } from "../src/tools/inventory/summaryMath";
import { summaryListInput } from "../src/tools/inventory/summaryList";

const period = {
  start: new Date("2026-08-20T00:00:00.000Z"),
  end: new Date("2026-08-20T23:59:59.999Z"),
};

const product = {
  itemKind: "product" as const,
  productId: "p1",
  variantId: null,
  ingredientId: null,
  currentQty: 400,
};

const sql = readFileSync(
  new URL("../../../supabase/migrations/20261108160000_mcp_list_inventory_summary.sql", import.meta.url),
  "utf8",
);

describe("summary columns", () => {
  it("rebuilds beginning from current stock minus later sales", () => {
    const columns = summaryColumns(product, [{
      itemKind: "product",
      productId: "p1",
      variantId: null,
      ingredientId: null,
      movementType: "sale",
      qtyDelta: -100,
      occurredAt: "2026-08-20T12:00:00.000Z",
    }], period);
    expect(columns).toMatchObject({
      beginning: 500,
      purchaseOrder: 0,
      sales: -100,
      transfer: 0,
      adjustment: 0,
      ending: 400,
    });
  });

  it("puts an adjustment in that column", () => {
    const columns = summaryColumns({ ...product, currentQty: 101 }, [{
      itemKind: "product",
      productId: "p1",
      variantId: null,
      ingredientId: null,
      movementType: "adjustment",
      qtyDelta: 1,
      occurredAt: "2026-08-20T12:00:00.000Z",
    }], period);
    expect(columns.beginning).toBe(100);
    expect(columns.adjustment).toBe(1);
    expect(columns.ending).toBe(101);
    expect(columns.sales).toBe(0);
  });

  it("counts opening, recipe use, and production in the Summary columns", () => {
    const columns = summaryColumns({
      itemKind: "ingredient",
      productId: null,
      variantId: null,
      ingredientId: "i1",
      currentQty: 13,
    }, [
      {
        itemKind: "ingredient",
        productId: null,
        variantId: null,
        ingredientId: "i1",
        movementType: "opening",
        qtyDelta: 10,
        occurredAt: "2026-08-20T01:00:00.000Z",
      },
      {
        itemKind: "ingredient",
        productId: null,
        variantId: null,
        ingredientId: "i1",
        movementType: "recipe_consume",
        qtyDelta: -2,
        occurredAt: "2026-08-20T08:00:00.000Z",
      },
      {
        itemKind: "ingredient",
        productId: null,
        variantId: null,
        ingredientId: "i1",
        movementType: "production",
        qtyDelta: 5,
        occurredAt: "2026-08-20T09:00:00.000Z",
      },
    ], period);
    expect(columns.adjustment).toBe(10);
    expect(columns.sales).toBe(-2);
    expect(columns.purchaseOrder).toBe(5);
  });

  it("counts a transfer on its own column", () => {
    const columns = summaryColumns(product, [{
      itemKind: "product",
      productId: "p1",
      variantId: null,
      ingredientId: null,
      movementType: "transfer",
      qtyDelta: -4,
      occurredAt: "2026-08-20T10:00:00.000Z",
    }], period);
    expect(columns.transfer).toBe(-4);
    expect(columns.beginning).toBe(404);
    expect(columns.ending).toBe(400);
  });
});

describe("mcp_list_inventory_summary", () => {
  it("uses the same column formula and stays inside the session organization", () => {
    expect(sql).toContain("item.current_qty - COALESCE(sums.after_start, 0)");
    expect(sql).toContain("item.current_qty - COALESCE(sums.after_end, 0)");
    expect(sql).toContain("movement.occurred_at > v_start");
    expect(sql).toContain("movement.occurred_at > v_end");
    expect(sql).toContain("('purchase_order', 'production')");
    expect(sql).toContain("('sale', 'recipe_consume')");
    expect(sql).toContain("movement.movement_type = 'transfer'");
    expect(sql).toContain("('adjustment', 'opening')");
    expect(sql).toContain("AND NOT EXISTS (");
    expect(sql).not.toContain("is_parent");
    expect(sql).toContain("outlet.organization_id = p_organization_id");
    expect(sql).toContain("movement.organization_id = p_organization_id");
    expect(sql).toContain("RAISE EXCEPTION 'not_a_member'");
    expect(sql).toContain("RAISE EXCEPTION 'not_found'");
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.mcp_list_inventory_summary(uuid, uuid, uuid, text, text, text, text) TO service_role");
    expect(sql).toContain("ranked.rn <= 200");
    const tool = readFileSync(new URL("../src/tools/inventory/summaryList.ts", import.meta.url), "utf8");
    const reader = readFileSync(new URL("../src/db/inventorySummary.ts", import.meta.url), "utf8");
    for (const source of [tool, reader]) {
      expect(source).not.toContain("createAdmin");
      expect(source).not.toContain("SERVICE_ROLE");
      expect(source).not.toContain("active_organization_id");
    }
  });
});

describe("inventory.summary.list", () => {
  it("rejects a range, a single date, a foreign organization, and a bad kind", () => {
    expect(summaryListInput.safeParse({}).success).toBe(true);
    expect(summaryListInput.safeParse({ date_start: "2026-11-01" }).success).toBe(false);
    expect(summaryListInput.safeParse({ date_end: "2026-11-01" }).success).toBe(false);
    expect(summaryListInput.safeParse({
      date_start: "2026-01-01",
      date_end: "2027-01-02",
    }).success).toBe(false);
    expect(summaryListInput.safeParse({
      date_start: "2026-01-01",
      date_end: "2026-12-31",
    }).success).toBe(true);
    expect(summaryListInput.safeParse({ kind: "sku" }).success).toBe(false);
    expect(summaryListInput.safeParse({ organization_id: "5fa70166-0a35-4f0d-94b3-54f19b3f8c30" }).success).toBe(false);
  });

  it("calls the session organization only", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        outlet_id: "9ade0045-0fc0-4545-9a3d-34866dff903a",
        outlet_name: "Sate Sultan PIK",
        period_start: "2026-11-08T00:00:00+07:00",
        period_end: "2026-11-08T23:59:59.999+07:00",
        truncated: false,
        rows: [{
          kind: "ingredient",
          name: "Ayam",
          variant_name: null,
          category: "Daging",
          current_qty: "13",
          beginning: 10,
          purchase_order: 5,
          sales: -2,
          transfer: 0,
          adjustment: 10,
          ending: 13,
        }],
      },
      error: null,
    });
    const admin = { rpc } as unknown as SupabaseClient;
    const result = await listInventorySummary(admin, {
      userId: "user-1",
      organizationId: "org-1",
    }, {
      outletId: "9ade0045-0fc0-4545-9a3d-34866dff903a",
      kind: "both",
      dateStart: "2026-11-08",
      dateEnd: "2026-11-08",
      search: null,
    });
    expect(rpc).toHaveBeenCalledWith("mcp_list_inventory_summary", {
      p_user_id: "user-1",
      p_organization_id: "org-1",
      p_outlet_id: "9ade0045-0fc0-4545-9a3d-34866dff903a",
      p_kind: "both",
      p_date_start: "2026-11-08",
      p_date_end: "2026-11-08",
      p_search: null,
    });
    expect(JSON.stringify(rpc.mock.calls)).not.toContain("org-2");
    expect(JSON.stringify(rpc.mock.calls)).not.toContain("access_token");
    expect(result.rows[0].current_qty).toBe(13);
    expect(result.rows[0].kind).toBe("ingredient");
  });

  it("maps another organization's member and a foreign outlet to the existing errors", async () => {
    const member = {
      rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "not_a_member" } }),
    } as unknown as SupabaseClient;
    const outlet = {
      rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "not_found" } }),
    } as unknown as SupabaseClient;
    const query = {
      outletId: "fb217c33-d7f9-4acb-ac2d-3577c2da52c5",
      kind: null,
      dateStart: null,
      dateEnd: null,
      search: null,
    };
    await expect(listInventorySummary(member, {
      userId: "outsider",
      organizationId: "org-1",
    }, query)).rejects.toThrow("not_a_member");
    await expect(listInventorySummary(outlet, {
      userId: "user-1",
      organizationId: "org-1",
    }, query)).rejects.toThrow("not_found");
  });
});
