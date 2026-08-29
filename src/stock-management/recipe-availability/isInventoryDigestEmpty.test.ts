import { describe, expect, it } from "vitest";
import { isInventoryDigestEmpty } from "./isInventoryDigestEmpty";

describe("isInventoryDigestEmpty", () => {
  it("skips when both lists are empty", () => {
    expect(isInventoryDigestEmpty({ ingredientCount: 0, menuCount: 0 })).toBe(true);
  });

  it("sends when ingredients have alerts", () => {
    expect(isInventoryDigestEmpty({ ingredientCount: 1, menuCount: 0 })).toBe(false);
  });

  it("sends when recipe menus are OOS", () => {
    expect(isInventoryDigestEmpty({ ingredientCount: 0, menuCount: 2 })).toBe(false);
  });
});
