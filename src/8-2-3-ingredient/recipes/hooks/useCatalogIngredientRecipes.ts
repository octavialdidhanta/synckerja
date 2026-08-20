import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { persistableRecipeLines } from "../lib/recipeCompleteness";
import type { CatalogIngredientRecipe, CatalogIngredientRecipeSave } from "../types";

export const CATALOG_INGREDIENT_RECIPES_QUERY_KEY = "catalog-ingredient-recipes";

type RecipeRow = {
  id: string;
  organization_id: string;
  output_ingredient_id: string;
  yield_qty: number | string;
  catalog_ingredient_recipe_lines?: Array<{
    ingredient_id: string;
    quantity: number | string;
    sort_order: number;
  }> | null;
};

function mapRecipe(row: RecipeRow): CatalogIngredientRecipe {
  const lines = (row.catalog_ingredient_recipe_lines ?? [])
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((line) => ({
      ingredient_id: line.ingredient_id,
      quantity: Number(line.quantity) || 0,
      sort_order: line.sort_order,
    }));
  return {
    id: row.id,
    organization_id: row.organization_id,
    output_ingredient_id: row.output_ingredient_id,
    yield_qty: Number(row.yield_qty) || 0,
    lines,
  };
}

export function useCatalogIngredientRecipes() {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [CATALOG_INGREDIENT_RECIPES_QUERY_KEY, organizationId],
    queryFn: async (): Promise<CatalogIngredientRecipe[]> => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from("catalog_ingredient_recipes")
        .select(
          "id, organization_id, output_ingredient_id, yield_qty, catalog_ingredient_recipe_lines(ingredient_id, quantity, sort_order)",
        )
        .eq("organization_id", organizationId);
      if (error) throw error;
      return ((data ?? []) as RecipeRow[]).map(mapRecipe);
    },
    enabled: !!organizationId,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: [CATALOG_INGREDIENT_RECIPES_QUERY_KEY, organizationId] });
  };

  const save = useMutation({
    mutationFn: async (payload: CatalogIngredientRecipeSave) => {
      if (!organizationId) throw new Error("Organization ID is required");
      const yieldQty = Number(payload.yieldQty);
      if (!Number.isFinite(yieldQty) || yieldQty <= 0) throw new Error("recipe_yield_required");
      const lines = persistableRecipeLines(payload.lines);
      if (lines.length === 0) throw new Error("recipe_lines_required");

      const { data, error } = await supabase
        .from("catalog_ingredient_recipes")
        .upsert(
          {
            organization_id: organizationId,
            output_ingredient_id: payload.outputIngredientId,
            yield_qty: yieldQty,
          },
          { onConflict: "output_ingredient_id" },
        )
        .select("id")
        .single();
      if (error) throw error;
      const recipeId = data.id as string;

      const { error: clearError } = await supabase
        .from("catalog_ingredient_recipe_lines")
        .delete()
        .eq("recipe_id", recipeId);
      if (clearError) throw clearError;

      const { error: insertError } = await supabase.from("catalog_ingredient_recipe_lines").insert(
        lines.map((line, index) => ({
          recipe_id: recipeId,
          ingredient_id: line.ingredient_id,
          organization_id: organizationId,
          quantity: line.quantity,
          sort_order: index + 1,
        })),
      );
      if (insertError) throw insertError;
      return recipeId;
    },
    onSuccess: invalidate,
  });

  const byOutputId = new Map((query.data ?? []).map((row) => [row.output_ingredient_id, row]));

  return {
    rows: query.data ?? [],
    byOutputId,
    isLoading: query.isLoading,
    save: save.mutateAsync,
    isSaving: save.isPending,
  };
}
