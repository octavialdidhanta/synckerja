import { describe, expect, it } from "vitest";
import type { PublicOrderItemOptions, PublicOrderModifierGroup } from "@/synckerja-order/shared/lib/orderTypes";
import { cartLineToCustomizeSelection } from "./cartLineToCustomizeSelection";

const toggleGroup: PublicOrderModifierGroup = {
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
};

const qtyGroup: PublicOrderModifierGroup = {
  id: "g2",
  name: "BEVERAGE",
  is_required: false,
  min_selected: 0,
  max_selected: 2,
  single_select: false,
  option_qty_enabled: true,
  options: [
    { id: "t1", name: "Lemon Tea - Iced", extra_price: 0, out_of_stock: false },
    { id: "t2", name: "Lemon Tea - Hot", extra_price: 0, out_of_stock: false },
  ],
};

function options(): PublicOrderItemOptions {
  return {
    ok: true,
    kind: "product",
    id: "p1",
    name: "Combat",
    description: null,
    unit_price: 50000,
    photo_path: null,
    variants: [
      { id: "v1", name: "Regular", price: 50000, out_of_stock: false },
      { id: "v2", name: "Large", price: 55000, out_of_stock: false },
    ],
    modifier_groups: [toggleGroup, qtyGroup],
    included_items: [],
  };
}

describe("cartLineToCustomizeSelection", () => {
  it("hydrates variant, toggle, option qty, and notes", () => {
    const { selection, kitchenNote } = cartLineToCustomizeSelection(options(), {
      variantId: "v2",
      modifiers: [
        { optionId: "o2", name: "Lv 1", extraPrice: 2000, quantity: 1 },
        { optionId: "t1", name: "Lemon Tea - Iced", extraPrice: 0, quantity: 2 },
      ],
      kitchenNote: "  pedas  ",
    });
    expect(selection.variantId).toBe("v2");
    expect(selection.selectedByGroup.g1).toEqual(["o2"]);
    expect(selection.qtyByGroup.g2).toEqual({ t1: 2 });
    expect(kitchenNote).toBe("pedas");
  });

  it("falls back to the default variant when the line variant is missing", () => {
    const { selection } = cartLineToCustomizeSelection(options(), {
      variantId: "missing",
      modifiers: [],
      kitchenNote: null,
    });
    expect(selection.variantId).toBe("v1");
    expect(selection.selectedByGroup.g1).toEqual(["o1"]);
  });
});
