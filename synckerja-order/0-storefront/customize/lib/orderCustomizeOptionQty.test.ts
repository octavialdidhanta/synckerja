import { describe, expect, it } from "vitest";
import type { PublicOrderModifierGroup } from "@/synckerja-order/shared/lib/orderTypes";
import {
  bumpOptionQty,
  canIncreaseOptionQty,
  isOptionQtyGroupValid,
  sumOptionQty,
} from "./orderCustomizeOptionQty";

const beverages: PublicOrderModifierGroup = {
  id: "bev",
  name: "Beverages",
  is_required: true,
  min_selected: 1,
  max_selected: 2,
  single_select: false,
  option_qty_enabled: true,
  options: [
    { id: "lemon", name: "Lemon Tea - Iced", extra_price: 0, out_of_stock: false },
    { id: "ice", name: "Ice Tea", extra_price: 2000, out_of_stock: false },
    { id: "ade", name: "Lemonade", extra_price: 3000, out_of_stock: false },
  ],
};

describe("bumpOptionQty", () => {
  it("adds two of the same option and clamps at max 2", () => {
    const one = bumpOptionQty({
      group: beverages,
      qtyByOption: {},
      optionId: "lemon",
      delta: 1,
      outOfStock: false,
    });
    const two = bumpOptionQty({
      group: beverages,
      qtyByOption: one,
      optionId: "lemon",
      delta: 1,
      outOfStock: false,
    });
    expect(two).toEqual({ lemon: 2 });
    const three = bumpOptionQty({
      group: beverages,
      qtyByOption: two,
      optionId: "lemon",
      delta: 1,
      outOfStock: false,
    });
    expect(three).toEqual({ lemon: 2 });
  });

  it("allows 1 + 1 across options and blocks a third unit", () => {
    const mixed = bumpOptionQty({
      group: beverages,
      qtyByOption: { lemon: 1 },
      optionId: "ice",
      delta: 1,
      outOfStock: false,
    });
    expect(mixed).toEqual({ lemon: 1, ice: 1 });
    expect(
      bumpOptionQty({
        group: beverages,
        qtyByOption: mixed,
        optionId: "ade",
        delta: 1,
        outOfStock: false,
      }),
    ).toEqual(mixed);
  });

  it("does not increase out-of-stock options", () => {
    expect(
      bumpOptionQty({
        group: beverages,
        qtyByOption: {},
        optionId: "lemon",
        delta: 1,
        outOfStock: true,
      }),
    ).toEqual({});
  });
});

describe("isOptionQtyGroupValid", () => {
  it("requires at least one unit and at most two", () => {
    expect(isOptionQtyGroupValid(beverages, {})).toBe(false);
    expect(isOptionQtyGroupValid(beverages, { lemon: 1 })).toBe(true);
    expect(isOptionQtyGroupValid(beverages, { lemon: 2 })).toBe(true);
    expect(isOptionQtyGroupValid(beverages, { lemon: 3 })).toBe(false);
  });
});

describe("canIncreaseOptionQty", () => {
  it("is false at max total units", () => {
    expect(canIncreaseOptionQty({ group: beverages, qtyByOption: { lemon: 2 }, outOfStock: false })).toBe(
      false,
    );
    expect(sumOptionQty({ lemon: 1, ice: 1 })).toBe(2);
  });
});
