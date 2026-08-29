import { formatRecipeBlockerNames, type RecipeStockBlocker } from "@/stock-management/recipe-availability";

/** Banner / toast label for recipe OOS (with ingredient reasons). */
export function recipeOutOfStockLabel(
  t: (key: string, fallback: string, vars?: Record<string, string | number>) => string,
  blockers: RecipeStockBlocker[] | undefined,
): { text: string; title: string } {
  if (!blockers || blockers.length === 0) {
    const text = t("posCashier.recipeOutOfStock", "Out of stock");
    return { text, title: text };
  }
  const { short, full } = formatRecipeBlockerNames(blockers, { maxNames: 2 });
  const text = t("posCashier.recipeOutOfStockWithReasons", "Out of stock · {{names}}", {
    names: short,
  });
  const title = t("posCashier.recipeOutOfStockWithReasons", "Out of stock · {{names}}", {
    names: full,
  });
  return { text, title };
}
