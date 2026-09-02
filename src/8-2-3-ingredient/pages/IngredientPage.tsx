import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import { useOrgBootstrapPending } from "@/shared/auth/hooks/useOrgBootstrapPending";
import { useDebouncedReady } from "@/shared/hooks/useDebouncedReady";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useSelectedPosOutlet } from "@/8-2-2-outlets/hooks/useSelectedPosOutlet";
import { LibraryIngredientCategoriesManager, useCatalogIngredientCategories } from "../categories";
import { IngredientModuleShell } from "../layout/IngredientModuleShell";
import { IngredientWorkspace } from "../layout/IngredientWorkspace";
import { ingredientTabFromPathname } from "../layout/IngredientHeaderAndTab";
import { LibraryIngredientsManager, useCatalogIngredients } from "../library";
import {
  ProductRecipesManager,
  buildProductRecipeListRows,
  useCatalogProductRecipes,
} from "../product-recipes";
import { useCatalogIngredientRecipes } from "../recipes";

function countForOutlet(rows: Array<{ outlet_ids?: string[] | null }>, outletId: string) {
  if (!outletId) return 0;
  return rows.filter((row) => (row.outlet_ids ?? []).includes(outletId)).length;
}

export default function IngredientPage() {
  const { t } = useAppTranslation();
  const location = useLocation();
  const { orgBootstrapPending } = useOrgBootstrapPending();
  const tab = ingredientTabFromPathname(location.pathname);
  const isLibrary = tab === "library";
  const isCategories = tab === "categories";
  const isRecipes = tab === "recipes";
  const needsOutlet = isLibrary || isCategories || isRecipes;
  const ingredients = useCatalogIngredients();
  const categories = useCatalogIngredientCategories();
  const recipes = useCatalogIngredientRecipes();
  const productRecipes = useCatalogProductRecipes();
  const {
    selectedOutletId,
    setSelectedOutletId,
    isLoading: outletsLoading,
  } = useSelectedPosOutlet(needsOutlet, { allowAll: false });
  const hasPendingLoad =
    orgBootstrapPending ||
    (needsOutlet && outletsLoading) ||
    (isLibrary && (ingredients.isLoading || recipes.isLoading)) ||
    (isCategories && (categories.isLoading || ingredients.isLoading)) ||
    (isRecipes && (productRecipes.isLoading || ingredients.isLoading));
  const showContent = useDebouncedReady(!hasPendingLoad, 200);

  const panelCount = useMemo(() => {
    if (isLibrary) return countForOutlet(ingredients.rows, selectedOutletId);
    if (isCategories) return countForOutlet(categories.rows, selectedOutletId);
    if (isRecipes) {
      return buildProductRecipeListRows({
        recipes: productRecipes.rows,
        products: productRecipes.products,
        modifierOptions: productRecipes.modifierOptions,
        ingredients: ingredients.rows,
        outletId: selectedOutletId,
      }).length;
    }
    return 0;
  }, [
    isLibrary,
    isCategories,
    isRecipes,
    ingredients.rows,
    categories.rows,
    productRecipes.rows,
    productRecipes.products,
    productRecipes.modifierOptions,
    selectedOutletId,
  ]);

  return (
    <IngredientModuleShell showContent={showContent}>
      <IngredientWorkspace count={panelCount}>
        {isLibrary ? (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-4 py-6">
            <LibraryIngredientsManager
              selectedOutletId={selectedOutletId}
              onOutletChange={setSelectedOutletId}
            />
          </div>
        ) : isCategories ? (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-4 py-6">
            <LibraryIngredientCategoriesManager
              selectedOutletId={selectedOutletId}
              onOutletChange={setSelectedOutletId}
            />
          </div>
        ) : isRecipes ? (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-4 py-6">
            <ProductRecipesManager
              selectedOutletId={selectedOutletId}
              onOutletChange={setSelectedOutletId}
            />
          </div>
        ) : (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col px-4 py-6">
            <h2 className="mb-1 text-lg font-semibold">
              {t("ingredient.tab.recipes", "Recipes")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t("ingredient.empty.recipes", "No recipes yet.")}
            </p>
          </div>
        )}
      </IngredientWorkspace>
    </IngredientModuleShell>
  );
}
