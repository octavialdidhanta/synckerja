import { useLocation } from "react-router-dom";
import { useOrgBootstrapPending } from "@/shared/auth/hooks/useOrgBootstrapPending";
import { useDebouncedReady } from "@/shared/hooks/useDebouncedReady";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useSelectedPosOutlet } from "@/8-2-2-outlets/hooks/useSelectedPosOutlet";
import { LibraryIngredientCategoriesManager, useCatalogIngredientCategories } from "../categories";
import { IngredientModuleShell } from "../layout/IngredientModuleShell";
import { ingredientTabFromPathname } from "../layout/IngredientHeaderAndTab";
import { LibraryIngredientsManager, useCatalogIngredients } from "../library";
import { ProductRecipesManager, useCatalogProductRecipes } from "../product-recipes";
import { useCatalogIngredientRecipes } from "../recipes";

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

  return (
    <IngredientModuleShell showContent={showContent}>
      <div className="grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch">
        <div className="col-span-12 flex min-h-0 min-w-0 flex-1 basis-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
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
        </div>
      </div>
      <div className="h-2 flex-shrink-0 [@media(max-height:900px)]:h-3 [@media(max-height:760px)]:h-4" aria-hidden />
    </IngredientModuleShell>
  );
}
