import { describe, expect, it } from "vitest";
import {
  categoryNameById,
  ingredientCategoryMembershipDiff,
  ingredientCountByCategoryForOutlet,
  isPostgresUniqueViolation,
} from "./ingredientCategoryMembership";

describe("ingredientCategoryMembershipDiff", () => {
  const rows = [
    { id: "a", category_id: "dairy" },
    { id: "b", category_id: null },
    { id: "c", category_id: "meat" },
  ];

  it("assigns newly checked ingredients and unassigns unchecked members", () => {
    expect(ingredientCategoryMembershipDiff(rows, "dairy", new Set(["b", "a"]))).toEqual([
      { id: "b", category_id: "dairy" },
    ]);
    expect(ingredientCategoryMembershipDiff(rows, "dairy", new Set(["b"]))).toEqual([
      { id: "a", category_id: null },
      { id: "b", category_id: "dairy" },
    ]);
  });

  it("returns no changes when membership is unchanged", () => {
    expect(ingredientCategoryMembershipDiff(rows, "dairy", new Set(["a"]))).toEqual([]);
  });
});

describe("ingredientCountByCategoryForOutlet", () => {
  it("counts ingredients assigned to the current outlet only", () => {
    const counts = ingredientCountByCategoryForOutlet(
      [
        { category_id: "dairy", outlet_ids: ["out-1"] },
        { category_id: "dairy", outlet_ids: ["out-2"] },
        { category_id: null, outlet_ids: ["out-1"] },
        { category_id: "meat", outlet_ids: ["out-1", "out-2"] },
      ],
      "out-1",
    );
    expect(counts.get("dairy")).toBe(1);
    expect(counts.get("meat")).toBe(1);
    expect(counts.get("missing")).toBeUndefined();
  });
});

describe("categoryNameById", () => {
  it("falls back to uncategorized when missing", () => {
    expect(categoryNameById([{ id: "dairy", name: "Dairy" }], null, "Uncategorized")).toBe(
      "Uncategorized",
    );
    expect(categoryNameById([{ id: "dairy", name: "Dairy" }], "dairy", "Uncategorized")).toBe("Dairy");
    expect(categoryNameById([], "gone", "Uncategorized")).toBe("Uncategorized");
  });
});

describe("isPostgresUniqueViolation", () => {
  it("detects postgres unique errors", () => {
    expect(isPostgresUniqueViolation({ code: "23505" })).toBe(true);
    expect(isPostgresUniqueViolation({ message: "duplicate key value violates unique constraint" })).toBe(
      true,
    );
    expect(isPostgresUniqueViolation({ code: "42501" })).toBe(false);
  });
});
