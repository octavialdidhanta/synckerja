import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { signCatalogProductPhotos } from "@/8-2-1-default-prices/lib/catalogProductPhoto";
import { persistableProductRecipeLines } from "../lib/productRecipeCompleteness";
import { productRecipeKey } from "../types";
import type {
  CatalogProductRecipe,
  CatalogProductRecipeSave,
  ProductRecipeTargetProduct,
  ProductRecipeVariantOption,
} from "../types";

export const CATALOG_PRODUCT_RECIPES_QUERY_KEY = "catalog-product-recipes";
export const CATALOG_PRODUCT_RECIPE_TARGETS_QUERY_KEY = "catalog-product-recipe-targets";

type RecipeRow = {
  id: string;
  organization_id: string;
  product_id: string;
  modifier_option_id: string | null;
  catalog_product_recipe_lines?: Array<{
    ingredient_id: string;
    quantity: number | string;
    sort_order: number;
  }> | null;
};

type ProductRow = {
  id: string;
  name: string;
  product_category_id: string | null;
  photo_path: string | null;
  catalog_product_outlets?: Array<{ outlet_id: string }> | null;
};

type ModifierLinkRow = {
  product_id: string;
  group_id: string;
  catalog_modifier_groups?: { name: string } | null;
};

type ModifierOptionRow = {
  id: string;
  group_id: string;
  name: string;
  is_active: boolean;
};

function mapRecipe(row: RecipeRow): CatalogProductRecipe {
  const lines = (row.catalog_product_recipe_lines ?? [])
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
    product_id: row.product_id,
    modifier_option_id: row.modifier_option_id ?? null,
    lines,
  };
}

async function fetchRecipeTargets(organizationId: string): Promise<{
  products: ProductRecipeTargetProduct[];
  modifierLinks: Array<{ product_id: string; group_id: string; group_name: string }>;
  modifierOptions: ProductRecipeVariantOption[];
}> {
  const [productsRes, linksRes, optionsRes] = await Promise.all([
    supabase
      .from("default_prices")
      .select("id, name, product_category_id, photo_path, catalog_product_outlets(outlet_id)")
      .eq("organization_id", organizationId)
      .eq("kind", "product")
      .order("name", { ascending: true }),
    supabase
      .from("catalog_product_modifiers")
      .select("product_id, group_id, catalog_modifier_groups(name)")
      .eq("organization_id", organizationId),
    supabase
      .from("catalog_modifier_options")
      .select("id, group_id, name, is_active")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
  ]);
  if (productsRes.error) throw productsRes.error;
  if (linksRes.error) throw linksRes.error;
  if (optionsRes.error) throw optionsRes.error;

  const productRows = (productsRes.data ?? []) as ProductRow[];
  const photoMap = await signCatalogProductPhotos(productRows.map((row) => row.photo_path ?? ""));
  const products: ProductRecipeTargetProduct[] = productRows.map((row) => ({
    id: row.id,
    name: row.name,
    product_category_id: row.product_category_id ?? null,
    photo_url: row.photo_path ? (photoMap.get(row.photo_path) ?? null) : null,
    outlet_ids: (row.catalog_product_outlets ?? []).map((link) => link.outlet_id),
  }));

  const modifierLinks = ((linksRes.data ?? []) as ModifierLinkRow[]).map((row) => ({
    product_id: row.product_id,
    group_id: row.group_id,
    group_name: row.catalog_modifier_groups?.name ?? "",
  }));

  const groupNameById = new Map(modifierLinks.map((link) => [link.group_id, link.group_name]));
  const modifierOptions: ProductRecipeVariantOption[] = ((optionsRes.data ?? []) as ModifierOptionRow[]).map(
    (row) => ({
      id: row.id,
      group_id: row.group_id,
      group_name: groupNameById.get(row.group_id) ?? "",
      name: row.name,
    }),
  );

  return { products, modifierLinks, modifierOptions };
}

export function useCatalogProductRecipes() {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();

  const recipesQuery = useQuery({
    queryKey: [CATALOG_PRODUCT_RECIPES_QUERY_KEY, organizationId],
    queryFn: async (): Promise<CatalogProductRecipe[]> => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from("catalog_product_recipes")
        .select(
          "id, organization_id, product_id, modifier_option_id, catalog_product_recipe_lines(ingredient_id, quantity, sort_order)",
        )
        .eq("organization_id", organizationId);
      if (error) throw error;
      return ((data ?? []) as RecipeRow[]).map(mapRecipe);
    },
    enabled: !!organizationId,
  });

  const targetsQuery = useQuery({
    queryKey: [CATALOG_PRODUCT_RECIPE_TARGETS_QUERY_KEY, organizationId],
    queryFn: () => fetchRecipeTargets(organizationId!),
    enabled: !!organizationId,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: [CATALOG_PRODUCT_RECIPES_QUERY_KEY, organizationId] });
  };

  const save = useMutation({
    mutationFn: async (payload: CatalogProductRecipeSave) => {
      if (!organizationId) throw new Error("Organization ID is required");
      const lines = persistableProductRecipeLines(payload.lines);
      if (lines.length === 0) throw new Error("product_recipe_lines_required");

      const modifierOptionId = payload.modifierOptionId ?? null;
      const existing = (recipesQuery.data ?? []).find(
        (row) =>
          row.product_id === payload.productId &&
          (row.modifier_option_id ?? null) === modifierOptionId,
      );

      let recipeId = existing?.id ?? "";
      if (existing) {
        const { error } = await supabase
          .from("catalog_product_recipes")
          .update({ product_id: payload.productId, modifier_option_id: modifierOptionId })
          .eq("id", existing.id);
        if (error) throw error;
        recipeId = existing.id;
      } else {
        const { data, error } = await supabase
          .from("catalog_product_recipes")
          .insert({
            organization_id: organizationId,
            product_id: payload.productId,
            modifier_option_id: modifierOptionId,
          })
          .select("id")
          .single();
        if (error) throw error;
        recipeId = data.id as string;
      }

      const { error: clearError } = await supabase
        .from("catalog_product_recipe_lines")
        .delete()
        .eq("recipe_id", recipeId);
      if (clearError) throw clearError;

      const { error: insertError } = await supabase.from("catalog_product_recipe_lines").insert(
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

  const byKey = new Map(
    (recipesQuery.data ?? []).map((row) => [
      productRecipeKey(row.product_id, row.modifier_option_id),
      row,
    ]),
  );

  const productIdsWithRecipe = new Set((recipesQuery.data ?? []).map((row) => row.product_id));

  return {
    rows: recipesQuery.data ?? [],
    byKey,
    productIdsWithRecipe,
    products: targetsQuery.data?.products ?? [],
    modifierLinks: targetsQuery.data?.modifierLinks ?? [],
    modifierOptions: targetsQuery.data?.modifierOptions ?? [],
    isLoading: recipesQuery.isLoading || targetsQuery.isLoading,
    save: save.mutateAsync,
    isSaving: save.isPending,
  };
}
