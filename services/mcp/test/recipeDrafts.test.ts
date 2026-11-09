import { readFileSync } from "node:fs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { createRecipeDraft, listRecipeDrafts, throwRecipeDraft } from "../src/db/recipeDrafts";
import { MCP_SERVER_INSTRUCTIONS } from "../src/mcp/instructions";
import { MCP_TOOLS } from "../src/mcp/registry";
import { recipeDraftCreate, recipeDraftCreateInput, recipeDraftListInput } from "../src/tools/inventory/recipeDrafts";

const sql = readFileSync(
  new URL("../../../supabase/migrations/20261109080000_catalog_recipe_drafts.sql", import.meta.url),
  "utf8",
);
const me = { userId: "user-1", organizationId: "org-1" };
const valid = {
  menu: "Sate Ayam Tanpa Lemak",
  lines: [
    { ingredient: "Daging Ayam", quantity: 180, unit: "g" },
    { ingredient: "Tusuk Sate", quantity: 10, unit: "pcs" },
  ],
  request_note: "porsi ayam jadi 180 gram",
};

describe("recipes.drafts.create input", () => {
  it("requires the menu, whole lines with a unit, and the user's request", () => {
    expect(recipeDraftCreateInput.safeParse(valid).success).toBe(true);
    for (const field of ["menu", "lines", "request_note"]) {
      const rest: Record<string, unknown> = { ...valid };
      delete rest[field];
      expect(recipeDraftCreateInput.safeParse(rest).success).toBe(false);
    }
    expect(recipeDraftCreateInput.safeParse({ ...valid, lines: [] }).success).toBe(false);
    expect(recipeDraftCreateInput.safeParse({
      ...valid,
      lines: [{ ingredient: "Daging Ayam", quantity: 180 }],
    }).success).toBe(false);
  });

  it("rejects unknown units, non-positive quantities, and extra fields", () => {
    const line = valid.lines[0];
    expect(recipeDraftCreateInput.safeParse({ ...valid, lines: [{ ...line, unit: "sendok" }] }).success).toBe(false);
    expect(recipeDraftCreateInput.safeParse({ ...valid, lines: [{ ...line, quantity: 0 }] }).success).toBe(false);
    expect(recipeDraftCreateInput.safeParse({ ...valid, publish: true }).success).toBe(false);
    expect(recipeDraftCreateInput.safeParse({ ...valid, organization_id: "org-2" }).success).toBe(false);
  });

  it("accepts the list filters", () => {
    expect(recipeDraftListInput.safeParse({}).success).toBe(true);
    expect(recipeDraftListInput.safeParse({ status: "all" }).success).toBe(true);
    expect(recipeDraftListInput.safeParse({ status: "draft" }).success).toBe(false);
  });
});

describe("recipe draft db calls", () => {
  it("sends the session organization and the user's own words", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { draft: { id: "d-1" } }, error: null });
    const admin = { rpc } as unknown as SupabaseClient;
    await createRecipeDraft(admin, me, recipeDraftCreate(recipeDraftCreateInput.parse(valid)));
    expect(rpc).toHaveBeenCalledWith("mcp_create_recipe_draft", {
      p_user_id: "user-1",
      p_organization_id: "org-1",
      p_outlet_id: null,
      p_product_name: "Sate Ayam Tanpa Lemak",
      p_lines: valid.lines,
      p_note: "porsi ayam jadi 180 gram",
    });
    await listRecipeDrafts(admin, me, null);
    expect(rpc).toHaveBeenLastCalledWith("mcp_list_recipe_drafts", {
      p_user_id: "user-1",
      p_organization_id: "org-1",
      p_status: null,
    });
  });

  it("keeps actionable detail and hides internals", () => {
    expect(() => throwRecipeDraft('ERROR: unit_mismatch: Tusuk Sate (pcs)')).toThrow("unit_mismatch: Tusuk Sate (pcs)");
    expect(() => throwRecipeDraft("ingredient_not_found: Garam")).toThrow("ingredient_not_found: Garam");
    expect(() => throwRecipeDraft("menu_not_found")).toThrow("menu_not_found");
    expect(() => throwRecipeDraft("forbidden")).toThrow("forbidden");
    expect(() => throwRecipeDraft('relation "x" does not exist')).toThrow("query_failed");
  });
});

describe("registry, instructions, and SQL guarantees", () => {
  it("creates drafts only; there is no publish tool", () => {
    const names = MCP_TOOLS.map((tool) => tool.name);
    expect(names).toContain("recipes.drafts.create");
    expect(names).toContain("recipes.drafts.list");
    expect(names.some((name) => name.includes("publish") && name.startsWith("recipes."))).toBe(false);
    const create = MCP_TOOLS.find((tool) => tool.name === "recipes.drafts.create");
    expect(create?.mutates).toBe(true);
    expect(create?.scopes).toEqual(["commerce:write"]);
    expect(create?.pagePath).toBe("/operations/ingredient/recipes");
    expect(create?.description).toContain("NOT active");
    expect(create?.description).toContain("Send the WHOLE recipe");
    expect(MCP_SERVER_INSTRUCTIONS).toContain("you cannot publish");
  });

  it("publishes only through an owner/admin app function with confirmation and stale checks", () => {
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.publish_recipe_draft(uuid, boolean) TO authenticated");
    expect(sql).not.toContain("publish_recipe_draft(uuid, boolean) TO service_role");
    expect(sql).toContain("ur.role IN ('owner', 'admin')");
    expect(sql).toContain("recipe_draft_confirmation_required");
    expect(sql).toContain("'code', 'stale'");
    expect(sql).toContain("INSERT INTO public.catalog_product_recipe_history");
    expect(sql).toContain("uq_catalog_recipe_drafts_pending_product");
    expect(sql).toContain("REVOKE INSERT, UPDATE, DELETE ON public.catalog_recipe_drafts FROM PUBLIC, anon, authenticated");
  });
});
