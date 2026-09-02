import { Link } from "react-router-dom";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { INGREDIENT_RECIPES_PATH } from "@/8-2-3-ingredient/layout/IngredientHeaderAndTab";
import { productSalesStockMode } from "@/stock-management/catalog-ledger/lib/productSalesStockMode";
import { FieldInfoTip } from "../../components/FieldInfoTip";

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
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span>{t("defaultPrices.product.stockMode", "Stock")}</span>
        <FieldInfoTip text={body} />
      </div>
      <Link
        to={INGREDIENT_RECIPES_PATH}
        className="inline-flex text-xs font-medium text-primary underline-offset-2 hover:underline"
      >
        {t("defaultPrices.product.recipeLink", "Open ingredient recipes")}
      </Link>
    </div>
  );
}
