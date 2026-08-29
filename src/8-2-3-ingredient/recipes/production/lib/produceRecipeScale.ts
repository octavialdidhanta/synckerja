import type { RecipeLineDraft } from "../../types";

export type ScaledProduceLine = {
  ingredientId: string;
  recipeQty: number;
  deductQty: number;
};

export function produceScaleFactor(produceQty: number, yieldQty: number): number | null {
  if (!(produceQty > 0) || !(yieldQty > 0)) return null;
  return produceQty / yieldQty;
}

export function scaleRecipeLinesForProduce(args: {
  lines: RecipeLineDraft[];
  produceQty: number;
  yieldQty: number;
}): ScaledProduceLine[] {
  const scale = produceScaleFactor(args.produceQty, args.yieldQty);
  if (scale == null) return [];
  return args.lines
    .filter((line) => line.ingredient_id && Number(line.quantity) > 0)
    .map((line) => {
      const recipeQty = Number(line.quantity) || 0;
      return {
        ingredientId: line.ingredient_id,
        recipeQty,
        deductQty: recipeQty * scale,
      };
    });
}

export type InsufficientProduceLine = {
  ingredientId: string;
  deductQty: number;
  availableQty: number;
};

export function findInsufficientProduceStock(args: {
  lines: ScaledProduceLine[];
  trackInventoryById: Map<string, boolean>;
  stockById: Map<string, number>;
}): InsufficientProduceLine | null {
  for (const line of args.lines) {
    if (!args.trackInventoryById.get(line.ingredientId)) continue;
    const available = args.stockById.get(line.ingredientId) ?? 0;
    if (line.deductQty > available) {
      return {
        ingredientId: line.ingredientId,
        deductQty: line.deductQty,
        availableQty: available,
      };
    }
  }
  return null;
}
