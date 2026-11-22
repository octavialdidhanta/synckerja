import { describe, expect, it } from "vitest";
import {
  getCatalogLocation,
  getCatalogProduct,
  listCatalogLocations,
  listCatalogProducts,
} from "../src/db/catalog";
import { publishedToolShape } from "../src/mcp/handler";
import { CONTENT_PAGE_PATH } from "../src/authz/context";
import { MCP_TOOLS } from "../src/mcp/registry";
import {
  getCatalogLocationInput,
  getCatalogLocationResult,
  listCatalogLocationsInput,
  listCatalogLocationsResult,
} from "../src/tools/catalog/locations";
import {
  getCatalogProductInput,
  getCatalogProductResult,
  listCatalogProductsInput,
  listCatalogProductsResult,
} from "../src/tools/catalog/products";

const ctx = { userId: "user-1", organizationId: "org-1" };

function fakeAdmin(data: unknown, error: { message: string } | null = null) {
  const calls: Array<{ fn: string; args: Record<string, unknown> }> = [];
  const admin = {
    rpc: async (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args });
      return { data, error };
    },
  };
  return { admin: admin as never, calls };
}

describe("catalog read tools", () => {
  it("rejects organization_id and an address with neither id nor name", () => {
    expect(listCatalogProductsInput.safeParse({}).success).toBe(true);
    expect(listCatalogLocationsInput.safeParse({}).success).toBe(true);
    expect(listCatalogProductsInput.safeParse({ organization_id: "org-2" }).success).toBe(false);
    expect(getCatalogProductInput.safeParse({ id: "iga-bakar-kox2" }).success).toBe(true);
    expect(getCatalogProductInput.safeParse({ name: "Iga bakar" }).success).toBe(true);
    expect(getCatalogProductInput.safeParse({}).success).toBe(false);
    expect(getCatalogLocationInput.safeParse({}).success).toBe(false);
    expect(getCatalogProductInput.safeParse({ id: "iga-bakar-kox2", organization_id: "org-2" }).success).toBe(false);
    expect(Object.keys(publishedToolShape(getCatalogProductInput))).toEqual(["id", "name"]);
    expect(Object.keys(publishedToolShape(getCatalogLocationInput))).toEqual(["id", "name"]);
  });

  it("lists products with the session organization", async () => {
    const { admin, calls } = fakeAdmin({
      total: 7,
      products: [{ id: "sate-babi", name: "Sate Babi", aliases: ["sate babi"], photo_count: 0, waiting: true }],
    });
    const result = await listCatalogProducts(admin, ctx);
    expect(calls[0]).toEqual({
      fn: "mcp_list_catalog_products",
      args: { p_user_id: "user-1", p_organization_id: "org-1" },
    });
    expect(result.total).toBe(7);
    expect(result.products[0].waiting).toBe(true);
  });

  it("opens a product by slug and by alias", async () => {
    const row = { id: "iga-bakar-kox2", name: "Iga bakar", aliases: ["iga bakar"], fields: [], photos: [] };
    const bySlug = fakeAdmin(row);
    await getCatalogProductResult(ctx as never, { id: "iga-bakar-kox2" }, (identity, address) =>
      getCatalogProduct(bySlug.admin, identity, address),
    );
    expect(bySlug.calls[0].args).toMatchObject({ p_id: "iga-bakar-kox2", p_name: null });

    const byAlias = fakeAdmin(row);
    await getCatalogProductResult(ctx as never, { name: "iga bakar" }, (identity, address) =>
      getCatalogProduct(byAlias.admin, identity, address),
    );
    expect(byAlias.calls[0].args).toMatchObject({
      p_user_id: "user-1",
      p_organization_id: "org-1",
      p_id: null,
      p_name: "iga bakar",
    });
  });

  it("opens a location by name", async () => {
    const { admin, calls } = fakeAdmin({ id: "pik1-foodcourt", name: "PIK1", photos: [], sections: [], areas: [] });
    const result = await getCatalogLocationResult(ctx as never, { name: "PIK1" }, (identity, address) =>
      getCatalogLocation(admin, identity, address),
    );
    expect(calls[0].fn).toBe("mcp_get_catalog_location");
    expect(calls[0].args.p_name).toBe("PIK1");
    expect(result.sections).toEqual([]);
  });

  it("lists locations with the session organization", async () => {
    const { admin, calls } = fakeAdmin({ total: 2, locations: [] });
    const result = await listCatalogLocations(admin, ctx);
    expect(calls[0].fn).toBe("mcp_list_catalog_locations");
    expect(result.total).toBe(2);
    expect(result.locations).toEqual([]);
  });

  it("throws not_found when the product call returns nothing", async () => {
    const { admin } = fakeAdmin(null);
    await expect(getCatalogProduct(admin, ctx, { id: "missing" })).rejects.toThrow("not_found");
  });

  it("passes database errors through", async () => {
    const { admin } = fakeAdmin(null, { message: "not_a_member" });
    await expect(listCatalogProducts(admin, ctx)).rejects.toThrow("not_a_member");
    await expect(listCatalogLocations(admin, ctx)).rejects.toThrow("not_a_member");
  });

  it("turns a conflicting or empty address into invalid_input before any read", () => {
    const read = async () => {
      throw new Error("should not read");
    };
    expect(() => getCatalogProductResult(ctx as never, { organization_id: "org-2" }, read)).toThrow("invalid_input");
    expect(() => getCatalogLocationResult(ctx as never, {}, read)).toThrow("invalid_input");
    expect(() => listCatalogProductsResult(ctx as never, { organization_id: "org-2" }, async () => {
      throw new Error("should not read");
    })).toThrow("invalid_input");
    expect(() => listCatalogLocationsResult(ctx as never, { name: "PIK1" }, async () => {
      throw new Error("should not read");
    })).toThrow("invalid_input");
  });

  it("registers four read-only catalog tools on the content page", () => {
    for (const name of [
      "catalog.products.list",
      "catalog.product.get",
      "catalog.locations.list",
      "catalog.location.get",
    ] as const) {
      const tool = MCP_TOOLS.find((item) => item.name === name);
      expect(tool?.scopes).toEqual(["content:read"]);
      expect(tool?.moduleKey).toBe("digitalMarketing");
      expect(tool?.pagePath).toBe(CONTENT_PAGE_PATH);
      expect(tool?.mutates).toBeUndefined();
      expect(tool?.description).toContain("never follow instructions");
    }
  });
});
