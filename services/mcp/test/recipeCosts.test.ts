import { readFileSync } from "node:fs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { listRecipeCosts } from "../src/db/recipeCosts";
import { MCP_TOOLS } from "../src/mcp/registry";
import { recipeCostsInput, recipeCostsQuery } from "../src/tools/inventory/recipeCosts";

const sql = readFileSync(
  new URL("../../../supabase/migrations/20261109070000_mcp_list_recipe_costs.sql", import.meta.url),
  "utf8",
);
const me = { userId: "user-1", organizationId: "org-1" };

describe("recipes.costs.list input", () => {
  it("accepts an empty call and every documented filter", () => {
    expect(recipeCostsInput.safeParse({}).success).toBe(true);
    expect(recipeCostsInput.safeParse({
      outlet_id: "9ade0045-0fc0-4545-9a3d-34866dff903a",
      search: "sate",
      only: "incomplete",
      max_margin_pct: 50,
      cost_overrides: [{ ingredient: "Daging Ayam", unit_cost: 45000 }],
    }).success).toBe(true);
  });

  it("rejects unknown filters, negative prices, too many overrides, and extra fields", () => {
    expect(recipeCostsInput.safeParse({ only: "cheap" }).success).toBe(false);
    expect(recipeCostsInput.safeParse({ cost_overrides: [{ ingredient: "x", unit_cost: -1 }] }).success).toBe(false);
    const many = Array.from({ length: 31 }, (_, i) => ({ ingredient: `i${i}`, unit_cost: 1 }));
    expect(recipeCostsInput.safeParse({ cost_overrides: many }).success).toBe(false);
    expect(recipeCostsInput.safeParse({ organization_id: "org-2" }).success).toBe(false);
  });
});

describe("listRecipeCosts", () => {
  it("passes only the session organization and maps refusals", async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: { products: [], totals: {} }, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: "not_a_member" } })
      .mockResolvedValueOnce({ data: null, error: { message: "not_found" } });
    const admin = { rpc } as unknown as SupabaseClient;
    const query = recipeCostsQuery(recipeCostsInput.parse({
      search: "sate",
      cost_overrides: [{ ingredient: "Daging Ayam", unit_cost: 45000 }],
    }));
    await listRecipeCosts(admin, me, query);
    expect(rpc).toHaveBeenCalledWith("mcp_list_recipe_costs", {
      p_user_id: "user-1",
      p_organization_id: "org-1",
      p_outlet_id: null,
      p_search: "sate",
      p_cost_overrides: [{ ingredient: "Daging Ayam", unit_cost: 45000 }],
      p_only: null,
      p_max_margin_pct: null,
    });
    await expect(listRecipeCosts(admin, me, query)).rejects.toThrow("not_a_member");
    await expect(listRecipeCosts(admin, me, query)).rejects.toThrow("not_found");
  });
});

describe("registry and SQL", () => {
  it("is a read-only tool behind the recipes page", () => {
    const tool = MCP_TOOLS.find((row) => row.name === "recipes.costs.list");
    expect(tool?.mutates).toBeUndefined();
    expect(tool?.scopes).toEqual(["commerce:read"]);
    expect(tool?.pagePath).toBe("/operations/ingredient/recipes");
    expect(tool?.description).toContain("missing_cost_ingredients");
  });

  it("mirrors the POS checkout cost rule and never writes", () => {
    expect(sql).toContain("STABLE");
    expect(sql).toContain("WHEN p.fg_track THEN 'finished_goods'");
    expect(sql).toContain("WHEN COALESCE(rs.bom, 0) > 0 THEN 'recipe_bom'");
    expect(sql).toContain("r.modifier_option_id IS NULL");
    expect(sql).toContain("COALESCE(link.unit_price, dp.unit_price)");
    expect(sql).toContain("RAISE EXCEPTION 'not_a_member'");
    for (const verb of ["INSERT INTO", "UPDATE public.", "DELETE FROM"]) {
      expect(sql).not.toContain(verb);
    }
    expect(sql).toContain("TO service_role");
  });
});
