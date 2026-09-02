import { describe, expect, it } from "vitest";
import type { PublicOrderCatalogItem, PublicOrderItemOptions } from "@/synckerja-order/shared/lib/orderTypes";
import { mapOrderCustomizeToCartLine } from "./mapOrderCustomizeToCartLine";
import { defaultOrderCustomizeSelection } from "./orderCustomizeSelection";

const item: PublicOrderCatalogItem = {
  id: "11111111-1111-1111-1111-111111111111",
  name: "Combat",
  description: null,
  unit_price: 50000,
  photo_path: null,
  product_category_id: null,
  product_category_name: null,
  pos_status: "available",
  kind: "product",
  service_id: null,
  sub_service_id: null,
  track_stock: false,
  inventory_sku_id: null,
  available_qty: null,
  variants: [],
  has_modifiers: true,
};

const options: PublicOrderItemOptions = {
  ok: true,
  kind: "product",
  id: item.id,
  name: item.name,
  description: null,
  unit_price: 50000,
  photo_path: null,
  variants: [],
  modifier_groups: [
    {
      id: "g1",
      name: "MIE",
      is_required: true,
      min_selected: 1,
      max_selected: 1,
      single_select: true,
      options: [
        { id: "o1", name: "Lv 0", extra_price: 0, out_of_stock: false },
        { id: "o2", name: "Lv 1", extra_price: 2000, out_of_stock: false },
      ],
    },
  ],
  included_items: [],
};

describe("mapOrderCustomizeToCartLine", () => {
  it("builds different line keys for different modifier picks", () => {
    const a = mapOrderCustomizeToCartLine({
      item,
      options,
      selection: defaultOrderCustomizeSelection(options),
      quantity: 1,
    });
    const b = mapOrderCustomizeToCartLine({
      item,
      options,
      selection: { variantId: null, selectedByGroup: { g1: ["o2"] }, qtyByGroup: {} },
      quantity: 1,
    });
    expect(a.lineKey).not.toBe(b.lineKey);
    expect(a.unitPrice).toBe(50000);
    expect(b.unitPrice).toBe(52000);
    expect(a.modifiers?.[0]?.optionId).toBe("o1");
  });

  it("puts notes and option qty on the line and splits fingerprints", () => {
    const withNote = mapOrderCustomizeToCartLine({
      item,
      options,
      selection: defaultOrderCustomizeSelection(options),
      quantity: 1,
      kitchenNote: "kurang es",
    });
    const without = mapOrderCustomizeToCartLine({
      item,
      options,
      selection: defaultOrderCustomizeSelection(options),
      quantity: 1,
    });
    expect(withNote.kitchenNote).toBe("kurang es");
    expect(withNote.lineKey).not.toBe(without.lineKey);
  });
});
