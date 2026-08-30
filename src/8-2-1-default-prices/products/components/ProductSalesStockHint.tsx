import { Link } from "react-router-dom";
import { Info } from "lucide-react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { INGREDIENT_RECIPES_PATH } from "@/8-2-3-ingredient/layout/IngredientHeaderAndTab";
import { productSalesStockMode } from "@/stock-management/catalog-ledger/lib/productSalesStockMode";

export type ProductSalesStockHintProps = {
  trackStock: boolean;
  hasBaseRecipe?: boolean;
};

export function ProductSalesStockHint({
  trackStock,
  hasBaseRecipe = false,
}: ProductSalesStockHintProps) {
  const { t } = useAppTranslation();
  const mode = productSalesStockMode({
    kind: "product",
    trackStock,
    hasBaseRecipe,
  });

  const body = hasBaseRecipe
    ? t(
        "defaultPrices.product.stockModeMenuRecipe",
        "Selling deducts ingredient stock from recipes on pay (not finished goods). Manage recipes under Ingredient → Recipes.",
      )
    : mode === "retailTracked"
      ? t(
          "defaultPrices.product.stockModeRetail",
          "Selling deducts finished goods stock on pay. Optional recipes also deduct Ingredient Library stock.",
        )
      : t(
          "defaultPrices.product.stockModeMenuRecipe",
          "Selling deducts ingredient stock from recipes on pay (not finished goods). Manage recipes under Ingredient → Recipes.",
        );

  return (
    <div className="space-y-2 rounded-md border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground">
      <p className="flex gap-2">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
        <span>{body}</span>
      </p>
      <Link
        to={INGREDIENT_RECIPES_PATH}
        className="inline-flex font-medium text-primary underline-offset-2 hover:underline"
      >
        {t("defaultPrices.product.recipeLink", "Open ingredient recipes")}
      </Link>
    </div>
  );
}
