import { describe, expect, it } from "vitest";
import { applyCatalogProductFields, presentCatalogProduct, withCatalogPhotoUrls, type CatalogProduct } from "../src/db/catalog";
import { signContentConfirmation, verifyContentConfirmation } from "../src/tools/content/contentConfirmation";
import { fieldChanges, productFieldsFromConfirmation } from "../src/tools/catalog/productFields";
import { FALLBACK_MENU_FIELDS } from "../../../supabase/functions/_shared/describeCatalogProduct";

const allowed = [
  { key: "main", label: "Main Subject", position: 1 },
  { key: "topping", label: "Signature Topping", position: 2 },
];

describe("catalog product field changes", () => {
  it("keeps omitted columns and rejects a key outside the template", () => {
    const diff = fieldChanges(allowed, [{ key: "main", body: "old" }], { main: "Mangkuk sop" });
    expect(diff.changes).toEqual([{ key: "main", label: "Main Subject", before: "old", after: "Mangkuk sop" }]);
    expect(diff.fields.map((field) => field.key)).toEqual(["main"]);
    expect(() => fieldChanges(allowed, [], { price: "Rp10" })).toThrow("field_forbidden");
    expect(() => fieldChanges(allowed, [], { main: "  " })).toThrow("field_empty");
  });

  it("issues no write when the text is already the same", () => {
    const diff = fieldChanges(allowed, [{ key: "main", body: "Mangkuk sop" }], { main: "Mangkuk sop" });
    expect(diff.changes).toEqual([]);
  });

  it("does not accept a brief confirmation for a product column", async () => {
    const identity = { userId: "user-1", organizationId: "org-1" };
    const signed = await signContentConfirmation("secret", identity, "content.briefs.update", { planId: "plan-1" });
    await expect(
      verifyContentConfirmation("secret", identity, "catalog.product.fields.update", signed.confirm_token),
    ).rejects.toThrow("confirmation_invalid");
  });

  it("reads only the menu and the columns out of a confirmation", () => {
    const parsed = productFieldsFromConfirmation({
      menu_id: "11111111-1111-4111-8111-111111111111",
      fields: [{ key: "main", body: "Mangkuk" }],
    });
    expect(parsed.fields).toEqual([{ key: "main", body: "Mangkuk" }]);
    expect(() => productFieldsFromConfirmation({ menu_id: "slug", fields: [] })).toThrow("confirmation_invalid");
  });

  it("saves nothing when a key is no longer on the template", async () => {
    const admin = { from() { throw new Error("wrote"); } };
    const ctx = { userId: "user-1", organizationId: "org-1" };
    const confirmId = "22222222-2222-4222-8222-222222222222";
    const menuId = "11111111-1111-4111-8111-111111111111";
    await expect(applyCatalogProductFields(admin as never, ctx, {
      menuId,
      fields: [{ key: "price", body: "10" }],
    }, confirmId, allowed)).rejects.toThrow("field_forbidden");
    await expect(applyCatalogProductFields(admin as never, ctx, {
      menuId,
      fields: [{ key: "main", body: " " }],
    }, confirmId, allowed)).rejects.toThrow("confirmation_invalid");
  });

  it("uses the same empty-template columns as the product form", () => {
    expect(FALLBACK_MENU_FIELDS.map((field) => field.key)).toEqual(["main", "topping", "garnish", "presentation", "sauce", "larangan", "khusus"]);
  });
});

describe("catalog photo urls", () => {
  const product: CatalogProduct = {
    id: "sop",
    name: "Sup Sum Sum Kambing",
    aliases: [],
    waiting: false,
    product_knowledge_id: null,
    fields: [],
    photos: [
      { file_path: "a.jpg", storage_path: "org/a.jpg", label: "A", ref: null, position: 0 },
      { file_path: "b.jpg", storage_path: null, label: "B", ref: null, position: 1 },
    ],
  };

  it("signs a reference photo for 15 minutes and says when none can be opened", async () => {
    const admin = {
      storage: {
        from: (bucket: string) => ({
          createSignedUrls: async (paths: string[], seconds: number) => {
            expect(bucket).toBe("catalog-media");
            expect(paths).toEqual(["org/a.jpg"]);
            expect(seconds).toBe(15 * 60);
            return { data: [{ path: "org/a.jpg", signedUrl: "https://example/a" }] };
          },
        }),
      },
    };
    const signed = await withCatalogPhotoUrls(admin as never, product);
    expect(signed.look).toBeNull();
    expect(signed.photo_visible).toBe(true);
    expect(signed.photos[0].download_url).toBe("https://example/a");
    expect(signed.photos[1].download_url).toBeNull();

    const empty = await withCatalogPhotoUrls({
      storage: { from: () => ({ createSignedUrls: async () => { throw new Error("down"); } }) },
    } as never, { ...product, photos: [{ ...product.photos[0], storage_path: "org/a.jpg" }] });
    expect(empty.look).toBeNull();
    expect(empty.photo_visible).toBe(false);
    expect(empty.photos[0].download_url).toBeNull();
  });

  it("signs the Item Library photo and leaves the reference url empty", async () => {
    const buckets: string[] = [];
    const admin = {
      from(table: string) {
        const query = {
          select() { return query; },
          eq() { return query; },
          order() { return query; },
          maybeSingle: async () => {
            if (table === "catalog_menus") {
              return { data: { name: "Sup Sum Sum Kambing", default_price_id: "price-1", feature_id: null, sub_service_id: null }, error: null };
            }
            if (table === "default_prices") return { data: { photo_path: "org/item.jpg" }, error: null };
            return { data: null, error: null };
          },
        };
        return query;
      },
      storage: {
        from: (bucket: string) => ({
          createSignedUrls: async (paths: string[], seconds: number) => {
            buckets.push(bucket);
            expect(paths).toEqual(["org/item.jpg"]);
            expect(seconds).toBe(15 * 60);
            return { data: [{ path: "org/item.jpg", signedUrl: "https://example/item" }] };
          },
        }),
      },
    };
    const signed = await presentCatalogProduct(admin as never, { userId: "user-1", organizationId: "org-1" }, product);
    expect(buckets).toEqual(["catalog-product-photos"]);
    expect(signed.look).toEqual({ source: "item", download_url: "https://example/item" });
    expect(signed.photo_visible).toBe(true);
    expect(signed.photos.every((photo) => photo.download_url == null)).toBe(true);
  });

  it("does not open the reference photo when the Item Library file cannot be signed", async () => {
    const buckets: string[] = [];
    const admin = {
      from(table: string) {
        const query = {
          select() { return query; },
          eq() { return query; },
          order() { return query; },
          maybeSingle: async () => {
            if (table === "catalog_menus") {
              return { data: { name: "Sup Sum Sum Kambing", default_price_id: "price-1", feature_id: null, sub_service_id: null }, error: null };
            }
            return { data: { photo_path: "org/item.jpg" }, error: null };
          },
        };
        return query;
      },
      storage: {
        from: (bucket: string) => ({
          createSignedUrls: async () => {
            buckets.push(bucket);
            throw new Error("down");
          },
        }),
      },
    };
    const signed = await presentCatalogProduct(admin as never, { userId: "user-1", organizationId: "org-1" }, product);
    expect(buckets).toEqual(["catalog-product-photos"]);
    expect(signed.look).toEqual({ source: "item", download_url: null });
    expect(signed.photo_visible).toBe(false);
    expect(signed.photos[0].download_url).toBeNull();
  });
});
