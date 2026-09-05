import { describe, expect, it } from "vitest";
import {
  buildPosCreateItemPayload,
  parsePosCreateItemPrice,
  POS_CREATE_ITEM_FORM_EMPTY,
} from "./usePosCreateItemForm";

describe("parsePosCreateItemPrice", () => {
  it("parses digit grouping", () => {
    expect(parsePosCreateItemPrice("15.000")).toBe(15000);
  });

  it("rejects zero and empty", () => {
    expect(parsePosCreateItemPrice("0")).toBeNull();
    expect(parsePosCreateItemPrice("")).toBeNull();
  });
});

describe("buildPosCreateItemPayload", () => {
  it("maps form to DefaultPriceCreate with outlet + sku", () => {
    const result = buildPosCreateItemPayload({
      organizationId: "org-1",
      outletId: "out-1",
      form: {
        ...POS_CREATE_ITEM_FORM_EMPTY,
        name: "Kopi",
        priceDisplay: "12000",
        catalogSku: "SKU-1",
        categoryId: "cat-1",
      },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload).toMatchObject({
      organization_id: "org-1",
      kind: "product",
      name: "Kopi",
      unit_price: 12000,
      catalog_sku: "SKU-1",
      product_category_id: "cat-1",
      outlet_ids: ["out-1"],
      selected_outlet_id: "out-1",
      photo_path: null,
      selected_outlet_stock: {
        in_stock: 0,
        alert_enabled: false,
        alert_at: null,
        track_cogs: false,
        avg_cost: 0,
      },
      variants: [],
    });
    expect(result.payload.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it("maps variants and clears catalog_sku", () => {
    const result = buildPosCreateItemPayload({
      organizationId: "org-1",
      outletId: "out-1",
      form: {
        ...POS_CREATE_ITEM_FORM_EMPTY,
        name: "Kopi",
        priceDisplay: "999",
        catalogSku: "IGNORE",
        variants: [
          { id: "v1", name: "Hot", sku: "H1", priceDisplay: "15.000" },
          { id: "v2", name: "Ice", sku: "I1", priceDisplay: "18.000" },
        ],
      },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload.catalog_sku).toBeNull();
    expect(result.payload.unit_price).toBe(15000);
    expect(result.payload.variants).toEqual([
      { id: "v1", name: "Hot", sku: "H1", price: 15000, sort_order: 1 },
      { id: "v2", name: "Ice", sku: "I1", price: 18000, sort_order: 2 },
    ]);
  });

  it("requires name and price", () => {
    expect(
      buildPosCreateItemPayload({
        organizationId: "org-1",
        outletId: "out-1",
        form: POS_CREATE_ITEM_FORM_EMPTY,
      }).ok,
    ).toBe(false);
  });
});
