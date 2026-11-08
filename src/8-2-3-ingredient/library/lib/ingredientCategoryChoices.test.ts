import { describe, expect, it } from "vitest";
import { ingredientCategoryChoices } from "./ingredientCategoryChoices";

const categories = [
  { id: "1", name: "Daging" },
  { id: "2", name: "test" },
];

describe("ingredientCategoryChoices", () => {
  it("lists uncategorized and existing categories when the field is empty", () => {
    expect(ingredientCategoryChoices({
      query: "",
      categories,
      uncategorizedLabel: "Uncategorized",
    })).toEqual([
      { kind: "uncategorized" },
      { kind: "existing", id: "1", name: "Daging" },
      { kind: "existing", id: "2", name: "test" },
      { kind: "create", name: "" },
    ]);
  });

  it("still offers create new when the outlet has no categories", () => {
    expect(ingredientCategoryChoices({
      query: "",
      categories: [],
      uncategorizedLabel: "Uncategorized",
    })).toEqual([{ kind: "uncategorized" }, { kind: "create", name: "" }]);
  });

  it("offers create new when the typed name does not exist", () => {
    expect(ingredientCategoryChoices({
      query: "Kultt",
      categories,
      uncategorizedLabel: "Uncategorized",
    })).toEqual([{ kind: "create", name: "Kultt" }]);
  });

  it("does not offer create new for an existing name", () => {
    expect(ingredientCategoryChoices({
      query: "daging",
      categories,
      uncategorizedLabel: "Uncategorized",
    })).toEqual([{ kind: "existing", id: "1", name: "Daging" }]);
  });
});
