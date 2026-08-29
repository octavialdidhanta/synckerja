import type {
  RecipeAvailability,
  RecipeBomLineInput,
  RecipeStockBlocker,
} from "./types";

function nameOf(line: RecipeBomLineInput): string {
  const n = line.ingredientName?.trim();
  return n || line.ingredientId;
}

/**
 * Analyze one product BOM against outlet stock.
 * Blockers = every tracked line that cannot cover 1 serving.
 * Limiting = line with the lowest floor(stock/qty) among tracked lines.
 */
export function analyzeRecipeServings(
  productId: string,
  lines: RecipeBomLineInput[],
  stockByIngredientId: Map<string, number>,
): RecipeAvailability {
  const tracked = lines.filter(
    (l) =>
      l.productId === productId &&
      l.trackInventory !== false &&
      Boolean(l.ingredientId) &&
      Number(l.quantityPerUnit) > 0,
  );

  if (tracked.length === 0) {
    return { productId, maxServings: null, blockers: [], limiting: null };
  }

  let max = Number.POSITIVE_INFINITY;
  let limiting: RecipeStockBlocker | null = null;
  const blockers: RecipeStockBlocker[] = [];

  for (const line of tracked) {
    const needed = Number(line.quantityPerUnit);
    const raw = stockByIngredientId.get(line.ingredientId);
    const available =
      Number.isFinite(raw) && raw != null && raw >= 0 ? Number(raw) : 0;
    const servings = Math.floor(available / needed);
    const blocker: RecipeStockBlocker = {
      ingredientId: line.ingredientId,
      ingredientName: nameOf(line),
      needed,
      available,
    };

    if (servings <= 0) {
      blockers.push(blocker);
    }

    if (servings < max) {
      max = servings;
      limiting = blocker;
    }
  }

  if (!Number.isFinite(max)) {
    return { productId, maxServings: null, blockers: [], limiting: null };
  }

  return {
    productId,
    maxServings: Math.max(0, max),
    blockers,
    limiting,
  };
}

/** Full map for all products present in bomLines. */
export function buildRecipeAvailabilityMap(
  bomLines: RecipeBomLineInput[],
  stockByIngredientId: Map<string, number>,
): Map<string, RecipeAvailability> {
  const byProduct = new Map<string, RecipeBomLineInput[]>();
  for (const line of bomLines) {
    if (!line.productId) continue;
    const list = byProduct.get(line.productId) ?? [];
    list.push(line);
    byProduct.set(line.productId, list);
  }

  const out = new Map<string, RecipeAvailability>();
  for (const [productId, lines] of byProduct) {
    out.set(productId, analyzeRecipeServings(productId, lines, stockByIngredientId));
  }
  return out;
}

/** Product IDs with maxServings === 0 (tracked recipe cannot serve 1). */
export function buildRecipeOutOfStockProductIds(
  bomLines: RecipeBomLineInput[],
  stockByIngredientId: Map<string, number>,
): Set<string> {
  const map = buildRecipeAvailabilityMap(bomLines, stockByIngredientId);
  const out = new Set<string>();
  for (const [productId, avail] of map) {
    if (avail.maxServings != null && avail.maxServings <= 0) out.add(productId);
  }
  return out;
}

export function formatRecipeBlockerNames(
  blockers: RecipeStockBlocker[],
  opts?: { maxNames?: number },
): { short: string; full: string } {
  const names = blockers.map((b) => b.ingredientName).filter(Boolean);
  const full = names.join(", ");
  const maxNames = opts?.maxNames ?? 2;
  if (names.length <= maxNames) return { short: full, full };
  const shown = names.slice(0, maxNames).join(", ");
  return { short: `${shown} +${names.length - maxNames}`, full };
}
