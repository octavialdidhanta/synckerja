import { lineAvgCost } from "../../../product-recipes/lib/productRecipeCost";
import type { CatalogIngredient } from "../../../library/types";
import type { ScaledProduceLine } from "./produceRecipeScale";

export type ProduceBatchCost = {
  totalCost: number;
  unitCost: number | null;
};

export function produceBatchCost(args: {
  scaledLines: ScaledProduceLine[];
  ingredientsById: Map<string, CatalogIngredient>;
  outletId: string;
  produceQty: number;
}): ProduceBatchCost {
  let totalCost = 0;
  for (const line of args.scaledLines) {
    const cost = lineAvgCost(
      args.ingredientsById.get(line.ingredientId),
      args.outletId,
      line.deductQty,
    );
    if (cost != null) totalCost += cost;
  }
  const unitCost =
    totalCost > 0 && args.produceQty > 0 ? totalCost / args.produceQty : null;
  return { totalCost, unitCost };
}
