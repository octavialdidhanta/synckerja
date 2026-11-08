import { z } from "zod";

/** What-if price for one ingredient; only changes this calculation, nothing is saved. */
const costOverride = z.object({
  ingredient: z.string().trim().min(1).max(120),
  unit_cost: z.number().min(0).max(999999999999.99),
}).strict();

export const recipeCostsInput = z.object({
  outlet_id: z.string().uuid().optional(),
  search: z.string().trim().max(80).optional(),
  only: z.enum(["all", "with_recipe", "without_recipe", "incomplete"]).optional(),
  max_margin_pct: z.number().min(-1000).max(100).optional(),
  cost_overrides: z.array(costOverride).max(30).optional(),
}).strict();

export type RecipeCostsQuery = {
  outletId: string | null;
  search: string | null;
  only: "all" | "with_recipe" | "without_recipe" | "incomplete" | null;
  maxMarginPct: number | null;
  costOverrides: Array<{ ingredient: string; unit_cost: number }>;
};

export function recipeCostsQuery(data: z.infer<typeof recipeCostsInput>): RecipeCostsQuery {
  return {
    outletId: data.outlet_id ?? null,
    search: data.search ? data.search : null,
    only: data.only ?? null,
    maxMarginPct: data.max_margin_pct ?? null,
    costOverrides: data.cost_overrides ?? [],
  };
}

export const RECIPE_COSTS_HOW_TO_READ = [
  "hpp is the cost per portion POS would record at checkout right now: finished_goods when the product tracks its own buy cost, recipe_bom from the base recipe, or null (cogs_source none) when POS records no cost.",
  "Ingredients in missing_cost_ingredients have no buy cost yet and count as Rp0, so hpp is lower than the real cost: always say which ingredients are missing.",
  "Recipe quantities are in each ingredient's unit_code (e.g. 0.15 with kg = 150 g).",
  "add_ons are modifier options with their own extra_cost; they are not in hpp.",
  "When uses_sales_type_prices is true, delivery or other sales types may have a different price than selling_price.",
  "When what_if is true, the numbers use cost_overrides_applied and are a simulation only; nothing was saved. Mention cost_overrides_not_found.",
  "Money is Rupiah. Read only: this does not change recipes, prices, or stock.",
].join(" ");
