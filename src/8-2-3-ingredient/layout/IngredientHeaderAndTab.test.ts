import { describe, expect, it } from "vitest";
import {
  INGREDIENT_CATEGORIES_PATH,
  INGREDIENT_LIST_PATH,
  INGREDIENT_RECIPES_PATH,
  ingredientTabFromPathname,
  ingredientTabLocation,
  ingredientTabPath,
} from "./IngredientHeaderAndTab";

describe("ingredientTabFromPathname", () => {
  it("maps ingredient pathnames to the matching tab", () => {
    expect(ingredientTabFromPathname(INGREDIENT_LIST_PATH)).toBe("library");
    expect(ingredientTabFromPathname(`${INGREDIENT_LIST_PATH}/`)).toBe("library");
    expect(ingredientTabFromPathname(INGREDIENT_CATEGORIES_PATH)).toBe("categories");
    expect(ingredientTabFromPathname(INGREDIENT_RECIPES_PATH)).toBe("recipes");
    expect(ingredientTabFromPathname("/operations/ingredient")).toBe("library");
  });
});

describe("ingredientTabPath", () => {
  it("returns ingredient pathnames", () => {
    expect(ingredientTabPath("library")).toBe(INGREDIENT_LIST_PATH);
    expect(ingredientTabPath("categories")).toBe(INGREDIENT_CATEGORIES_PATH);
    expect(ingredientTabPath("recipes")).toBe(INGREDIENT_RECIPES_PATH);
  });
});

describe("ingredientTabLocation", () => {
  it("keeps the current search when switching tabs", () => {
    expect(ingredientTabLocation(INGREDIENT_CATEGORIES_PATH, "?outlet=abc")).toEqual({
      pathname: INGREDIENT_CATEGORIES_PATH,
      search: "?outlet=abc",
    });
  });
});
