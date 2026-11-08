export const UNCATEGORIZED_CATEGORY_VALUE = "__uncategorized__";

export type IngredientCategoryChoice =
  | { kind: "uncategorized" }
  | { kind: "existing"; id: string; name: string }
  | { kind: "create"; name: string };

function sameName(left: string, right: string): boolean {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

/** Dropdown rows for a typeable ingredient category field. */
export function ingredientCategoryChoices(args: {
  query: string;
  categories: Array<{ id: string; name: string }>;
  uncategorizedLabel: string;
}): IngredientCategoryChoice[] {
  const query = args.query.trim();
  const categories = [...args.categories].sort((a, b) => a.name.localeCompare(b.name));
  if (!query) {
    return [
      { kind: "uncategorized" },
      ...categories.map((row) => ({ kind: "existing" as const, id: row.id, name: row.name })),
      // Always reachable, even when the outlet has no categories yet.
      { kind: "create", name: "" },
    ];
  }
  const matches = categories.filter((row) => row.name.toLowerCase().includes(query.toLowerCase()));
  const exact = categories.some((row) => sameName(row.name, query));
  const isUncategorized = sameName(query, args.uncategorizedLabel);
  const rows: IngredientCategoryChoice[] = [];
  if (isUncategorized || args.uncategorizedLabel.toLowerCase().includes(query.toLowerCase())) {
    rows.push({ kind: "uncategorized" });
  }
  for (const row of matches) {
    rows.push({ kind: "existing", id: row.id, name: row.name });
  }
  if (!exact && !isUncategorized) {
    rows.push({ kind: "create", name: query });
  }
  return rows;
}
