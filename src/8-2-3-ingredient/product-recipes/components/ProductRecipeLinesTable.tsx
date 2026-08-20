import { Trash2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useCatalogIngredients } from "../../library/hooks/useCatalogIngredients";
import { ingredientInitials } from "../../library/lib/ingredientInitials";
import { formatIngredientStockQty } from "../../library/lib/ingredientStockStatus";
import { formatIngredientUnitCode } from "../../library/lib/ingredientUnits";
import type { CatalogIngredient } from "../../library/types";
import { formatRecipeCost, lineAvgCost } from "../lib/productRecipeCost";
import type { ProductRecipeLineDraft } from "../types";

export type ProductRecipeLinesTableProps = {
  lines: ProductRecipeLineDraft[];
  selectedOutletId: string;
  onChange: (lines: ProductRecipeLineDraft[]) => void;
};

export function ProductRecipeLinesTable({
  lines,
  selectedOutletId,
  onChange,
}: ProductRecipeLinesTableProps) {
  const { t } = useAppTranslation();
  const { rows: ingredientRows } = useCatalogIngredients();
  const ingredientsById = new Map<string, CatalogIngredient>(
    ingredientRows.map((row) => [row.id, row]),
  );

  if (lines.length === 0) return null;

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full min-w-[520px] text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
            <th className="px-3 py-2 font-medium">
              {t("ingredient.productRecipe.columnIngredient", "Ingredient")}
            </th>
            <th className="px-3 py-2 font-medium">
              {t("ingredient.productRecipe.columnQuantity", "Quantity")}
            </th>
            <th className="px-3 py-2 font-medium">{t("ingredient.productRecipe.columnUnit", "Unit")}</th>
            <th className="px-3 py-2 font-medium">
              {t("ingredient.productRecipe.columnAvgCost", "Avg Cost")}
            </th>
            <th className="w-10 px-2 py-2" aria-hidden />
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => {
            const ingredient = ingredientsById.get(line.ingredient_id);
            const lineCost = lineAvgCost(ingredient, selectedOutletId, line.quantity);
            return (
              <tr key={line.ingredient_id} className="border-b last:border-b-0">
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-[10px] font-medium uppercase text-muted-foreground">
                      {ingredient?.photo_url ? (
                        <img src={ingredient.photo_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        ingredientInitials(ingredient?.name ?? "") || "—"
                      )}
                    </div>
                    <span className="min-w-0 truncate">{ingredient?.name ?? line.ingredient_id}</span>
                  </div>
                </td>
                <td className="px-3 py-2">
                  <Input
                    value={line.quantity ? formatIngredientStockQty(line.quantity) : ""}
                    onChange={(e) => {
                      const next = Number(e.target.value);
                      onChange(
                        lines.map((item) =>
                          item.ingredient_id === line.ingredient_id
                            ? {
                                ...item,
                                quantity: Number.isFinite(next) && next >= 0 ? next : 0,
                              }
                            : item,
                        ),
                      );
                    }}
                    className="h-8 w-24"
                    inputMode="decimal"
                  />
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {ingredient ? formatIngredientUnitCode(ingredient.unit_code) : "—"}
                </td>
                <td className="px-3 py-2 text-muted-foreground">{formatRecipeCost(lineCost)}</td>
                <td className="px-2 py-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() =>
                      onChange(lines.filter((item) => item.ingredient_id !== line.ingredient_id))
                    }
                    aria-label={t("common.delete", "Delete")}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
