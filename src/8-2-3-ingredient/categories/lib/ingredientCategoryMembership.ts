export type IngredientCategoryMembership = {
  id: string;
  category_id: string | null;
};

export type IngredientCategoryAssignmentChange = {
  id: string;
  category_id: string | null;
};

export function ingredientCategoryMembershipDiff(
  ingredients: IngredientCategoryMembership[],
  categoryId: string,
  selectedIds: ReadonlySet<string>,
): IngredientCategoryAssignmentChange[] {
  if (!categoryId) return [];
  return ingredients.flatMap((row) => {
    const checked = selectedIds.has(row.id);
    const wasThis = row.category_id === categoryId;
    if (checked && !wasThis) return [{ id: row.id, category_id: categoryId }];
    if (!checked && wasThis) return [{ id: row.id, category_id: null }];
    return [];
  });
}

export function ingredientCountByCategoryForOutlet(
  ingredients: Array<{ category_id: string | null; outlet_ids: string[] }>,
  outletId: string,
): Map<string, number> {
  const counts = new Map<string, number>();
  if (!outletId) return counts;
  for (const row of ingredients) {
    if (!row.category_id) continue;
    if (!(row.outlet_ids ?? []).includes(outletId)) continue;
    counts.set(row.category_id, (counts.get(row.category_id) ?? 0) + 1);
  }
  return counts;
}

export function categoryNameById(
  categories: Array<{ id: string; name: string }>,
  categoryId: string | null,
  uncategorized: string,
): string {
  if (!categoryId) return uncategorized;
  return categories.find((row) => row.id === categoryId)?.name ?? uncategorized;
}

export function isPostgresUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String((error as { code: unknown }).code) : "";
  if (code === "23505") return true;
  const message = "message" in error ? String((error as { message: unknown }).message) : "";
  return /duplicate key|unique constraint/i.test(message);
}
