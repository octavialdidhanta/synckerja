import { describe, expect, it } from "vitest";
import { parseRecipeQtyText } from "./recipeQtyText";

describe("parseRecipeQtyText", () => {
  it("reads comma and dot decimals", () => {
    expect(parseRecipeQtyText("0,15")).toBe(0.15);
    expect(parseRecipeQtyText("0.15")).toBe(0.15);
    expect(parseRecipeQtyText(",5")).toBe(0.5);
  });

  it("keeps partial input readable while typing", () => {
    expect(parseRecipeQtyText("0")).toBe(0);
    expect(parseRecipeQtyText("0,")).toBe(0);
    expect(parseRecipeQtyText("1.")).toBe(1);
  });

  it("rejects empty and unreadable text", () => {
    expect(parseRecipeQtyText("")).toBeNull();
    expect(parseRecipeQtyText(",")).toBeNull();
    expect(parseRecipeQtyText("1,2,3")).toBeNull();
    expect(parseRecipeQtyText("abc")).toBeNull();
  });
});
