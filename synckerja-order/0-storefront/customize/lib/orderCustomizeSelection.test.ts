import { describe, expect, it } from "vitest";
import type { PublicOrderItemOptions, PublicOrderModifierGroup } from "@/synckerja-order/shared/lib/orderTypes";
import {
  defaultOrderCustomizeSelection,
  isOrderCustomizeValid,
  orderCustomizeLineTotal,
  orderCustomizeUnitPrice,
  toggleOrderCustomizeOption,
} from "./orderCustomizeSelection";

const requiredSingle: PublicOrderModifierGroup = {
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

const optionalMulti: PublicOrderModifierGroup = {
  id: "g2",
  name: "TOPPING",
  is_required: false,
  min_selected: 0,
  max_selected: 2,
  single_select: false,
  options: [
    { id: "t1", name: "Telur", extra_price: 3000, out_of_stock: false },
    { id: "t2", name: "Keju", extra_price: 4000, out_of_stock: false },
    { id: "t3", name: "Nori", extra_price: 1000, out_of_stock: true },
  ],
};

function options(patch?: Partial<PublicOrderItemOptions>): PublicOrderItemOptions {
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
    modifier_groups: [requiredSingle, optionalMulti],
    included_items: [],
    ...patch,
  };
}

describe("defaultOrderCustomizeSelection", () => {
  it("picks the first variant and required single in-stock option", () => {
    const sel = defaultOrderCustomizeSelection(options());
    expect(sel.variantId).toBe("v1");
    expect(sel.selectedByGroup.g1).toEqual(["o1"]);
    expect(sel.selectedByGroup.g2).toEqual([]);
    expect(sel.qtyByGroup.g1).toBeUndefined();
    expect(sel.qtyByGroup.g2).toBeUndefined();
  });
});

describe("toggleOrderCustomizeOption", () => {
  it("replaces a required single select", () => {
    expect(toggleOrderCustomizeOption(requiredSingle, ["o1"], "o2", false)).toEqual(["o2"]);
  });

  it("does not clear a required single select", () => {
    expect(toggleOrderCustomizeOption(requiredSingle, ["o1"], "o1", false)).toEqual(["o1"]);
  });

  it("caps multi select at max and skips out of stock", () => {
    const one = toggleOrderCustomizeOption(optionalMulti, [], "t1", false);
    const two = toggleOrderCustomizeOption(optionalMulti, one, "t2", false);
    expect(two).toEqual(["t1", "t2"]);
    expect(toggleOrderCustomizeOption(optionalMulti, two, "t3", true)).toEqual(two);
  });
});

describe("isOrderCustomizeValid", () => {
  it("is valid after defaults", () => {
    const opts = options();
    expect(isOrderCustomizeValid(opts, defaultOrderCustomizeSelection(opts))).toBe(true);
  });

  it("is invalid when a required group is empty", () => {
    const opts = options();
    const sel = defaultOrderCustomizeSelection(opts);
    sel.selectedByGroup.g1 = [];
    expect(isOrderCustomizeValid(opts, sel)).toBe(false);
  });
});

describe("orderCustomizeUnitPrice", () => {
  it("adds variant price and modifier extras, then multiplies qty", () => {
    const opts = options();
    const sel = defaultOrderCustomizeSelection(opts);
    sel.variantId = "v2";
    sel.selectedByGroup.g2 = ["t1"];
    expect(orderCustomizeUnitPrice(opts, sel)).toBe(58000);
    expect(orderCustomizeLineTotal(opts, sel, 2)).toBe(116000);
  });

  it("multiplies extra_price by option quantity", () => {
    const bev: PublicOrderModifierGroup = {
      id: "bev",
      name: "Beverages",
      is_required: true,
      min_selected: 1,
      max_selected: 2,
      single_select: false,
      option_qty_enabled: true,
      options: [
        { id: "lemon", name: "Lemon Tea", extra_price: 0, out_of_stock: false },
        { id: "ice", name: "Ice Tea", extra_price: 2000, out_of_stock: false },
      ],
    };
    const opts = options({ modifier_groups: [requiredSingle, bev] });
    const sel = defaultOrderCustomizeSelection(opts);
    sel.qtyByGroup.bev = { ice: 2 };
    expect(orderCustomizeUnitPrice(opts, sel)).toBe(54000);
    expect(isOrderCustomizeValid(opts, sel)).toBe(true);
  });
});
