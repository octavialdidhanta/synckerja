import { describe, expect, it } from "vitest";
import { productStockCommitScope } from "../lib/productStockCommitScope";

describe("productStockCommitScope", () => {
  it("kitchen phase returns recipeMenu for recipe products", () => {
    expect(
      productStockCommitScope({
        line: { kind: "product", trackStock: false },
        hasBaseRecipe: true,
        commitPoint: "kitchen",
        phase: "kitchen",
      }),
    ).toBe("recipeMenu");
  });

  it("kitchen pay phase returns retailTracked only", () => {
    expect(
      productStockCommitScope({
        line: { kind: "product", trackStock: true },
        commitPoint: "kitchen",
        phase: "pay",
      }),
    ).toBe("retailTracked");
  });

  it("fulfillment pay phase skips", () => {
    expect(
      productStockCommitScope({
        line: { kind: "product", trackStock: true },
        commitPoint: "fulfillment",
        phase: "pay",
      }),
    ).toBe("skip");
  });

  it("pay mode always includes product at pay phase", () => {
    expect(
      productStockCommitScope({
        line: { kind: "product", trackStock: false },
        hasBaseRecipe: true,
        commitPoint: "pay",
        phase: "pay",
      }),
    ).toBe("recipeMenu");
  });
});
