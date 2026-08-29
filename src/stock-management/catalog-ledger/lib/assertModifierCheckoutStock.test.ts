import { describe, expect, it } from "vitest";
import { findInsufficientModifierStock } from "./assertModifierCheckoutStock";
import {
  CHECKOUT_INSUFFICIENT_INGREDIENT_STOCK,
  CHECKOUT_INSUFFICIENT_PRODUCT_STOCK,
  CATALOG_STOCK_INSUFFICIENT,
  CheckoutStockError,
  parseCheckoutPayStockError,
  parseCheckoutStockError,
} from "./checkoutStockErrors";
import { resolveCheckoutStockToast } from "./checkoutStockToast";

const t = (key: string, defaultValue: string, params?: Record<string, string | number>) => {
  if (params) {
    return defaultValue.replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(params[name] ?? ""));
  }
  return defaultValue;
};

describe("findInsufficientModifierStock", () => {
  it("multiplies option BOM by line qty", () => {
    const result = findInsufficientModifierStock({
      lines: [
        {
          kind: "product",
          catalogId: "p1",
          quantity: 2,
          label: "Latte",
          modifiers: [{ optionId: "opt-extra" }],
        },
      ],
      optionBomLines: [
        {
          optionId: "opt-extra",
          ingredientId: "milk",
          quantityPerUnit: 50,
          ingredientName: "Milk",
          stockEnabled: true,
        },
      ],
      stockByIngredientId: new Map([["milk", 80]]),
    });
    expect(result).toMatchObject({
      ingredientId: "milk",
      needed: 100,
      available: 80,
      ingredientName: "Milk",
    });
  });

  it("skips option BOM when stockEnabled is false", () => {
    expect(
      findInsufficientModifierStock({
        lines: [
          {
            kind: "product",
            catalogId: "p1",
            quantity: 5,
            modifiers: [{ optionId: "opt-x" }],
          },
        ],
        optionBomLines: [
          {
            optionId: "opt-x",
            ingredientId: "syrup",
            quantityPerUnit: 10,
            stockEnabled: false,
          },
        ],
        stockByIngredientId: new Map([["syrup", 0]]),
      }),
    ).toBeNull();
  });

  it("aggregates shared ingredient demand across lines", () => {
    const result = findInsufficientModifierStock({
      lines: [
        {
          kind: "product",
          catalogId: "p1",
          quantity: 1,
          modifiers: [{ optionId: "opt-a" }],
        },
        {
          kind: "product",
          catalogId: "p1",
          quantity: 1,
          modifiers: [{ optionId: "opt-b" }],
        },
      ],
      optionBomLines: [
        {
          optionId: "opt-a",
          ingredientId: "pearl",
          quantityPerUnit: 30,
          ingredientName: "Pearl",
          stockEnabled: true,
        },
        {
          optionId: "opt-b",
          ingredientId: "pearl",
          quantityPerUnit: 40,
          ingredientName: "Pearl",
          stockEnabled: true,
        },
      ],
      stockByIngredientId: new Map([["pearl", 60]]),
    });
    expect(result).toMatchObject({ needed: 70, available: 60, ingredientId: "pearl" });
  });

  it("scopes fallback recipe BOM by productId for shared option", () => {
    const result = findInsufficientModifierStock({
      lines: [
        {
          kind: "product",
          catalogId: "latte",
          quantity: 1,
          label: "Latte",
          modifiers: [{ optionId: "opt-shot" }],
        },
      ],
      optionBomLines: [
        {
          optionId: "opt-shot",
          productId: "latte",
          ingredientId: "espresso",
          quantityPerUnit: 30,
          ingredientName: "Espresso",
          stockEnabled: true,
        },
        {
          optionId: "opt-shot",
          productId: "tea",
          ingredientId: "espresso",
          quantityPerUnit: 10,
          ingredientName: "Espresso",
          stockEnabled: true,
        },
      ],
      stockByIngredientId: new Map([["espresso", 35]]),
    });
    expect(result).toBeNull();
  });

  it("applies global sheet BOM to multiple products selecting the same option", () => {
    const result = findInsufficientModifierStock({
      lines: [
        {
          kind: "product",
          catalogId: "latte",
          quantity: 1,
          modifiers: [{ optionId: "opt-pearl" }],
        },
        {
          kind: "product",
          catalogId: "tea",
          quantity: 1,
          modifiers: [{ optionId: "opt-pearl" }],
        },
      ],
      optionBomLines: [
        {
          optionId: "opt-pearl",
          ingredientId: "pearl",
          quantityPerUnit: 20,
          ingredientName: "Pearl",
          stockEnabled: true,
        },
      ],
      stockByIngredientId: new Map([["pearl", 30]]),
    });
    expect(result).toMatchObject({ needed: 40, available: 30, ingredientId: "pearl" });
  });
});

describe("parseCheckoutPayStockError", () => {
  it("reads CheckoutStockError ingredient name", () => {
    expect(
      parseCheckoutPayStockError(
        new CheckoutStockError(CHECKOUT_INSUFFICIENT_INGREDIENT_STOCK, "Flour"),
      ),
    ).toEqual({ kind: "ingredient", ingredientName: "Flour" });
  });

  it("parses product and catalog codes from messages", () => {
    expect(parseCheckoutPayStockError(new Error(CHECKOUT_INSUFFICIENT_PRODUCT_STOCK))).toEqual({
      kind: "product",
    });
    expect(
      parseCheckoutPayStockError(new Error("Failed: catalog_stock_insufficient at line 1")),
    ).toEqual({ kind: "catalog" });
  });

  it("keeps parseCheckoutStockError backward compatibility", () => {
    expect(
      parseCheckoutStockError(
        new CheckoutStockError(CHECKOUT_INSUFFICIENT_INGREDIENT_STOCK, "Sugar"),
      ),
    ).toEqual({
      code: CHECKOUT_INSUFFICIENT_INGREDIENT_STOCK,
      ingredientName: "Sugar",
    });
    expect(parseCheckoutStockError(new Error(CATALOG_STOCK_INSUFFICIENT))).toEqual({
      code: CATALOG_STOCK_INSUFFICIENT,
    });
  });
});

describe("resolveCheckoutStockToast", () => {
  it("returns ingredient toast with detail", () => {
    expect(
      resolveCheckoutStockToast(
        new CheckoutStockError(CHECKOUT_INSUFFICIENT_INGREDIENT_STOCK, "Milk"),
        t,
      ),
    ).toEqual({
      title: "Not enough ingredient stock for this order.",
      description: "Milk is short for this order.",
    });
  });

  it("returns catalog toast for RPC insufficient", () => {
    expect(resolveCheckoutStockToast(new Error(CATALOG_STOCK_INSUFFICIENT), t)).toEqual({
      title: "Not enough stock to complete this order.",
      description: undefined,
    });
  });

  it("returns product toast with cart line context", () => {
    expect(
      resolveCheckoutStockToast(new Error(CHECKOUT_INSUFFICIENT_PRODUCT_STOCK), t, {
        lines: [
          {
            kind: "product",
            trackStock: true,
            serviceName: "Bottle Water",
            availableQty: 2,
            quantity: 3,
          },
        ],
      }),
    ).toEqual({
      title: "Not enough stock",
      description: "Bottle Water only has 2 left.",
    });
  });
});
