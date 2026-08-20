import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { CATALOG_INGREDIENTS_QUERY_KEY } from "../../library/hooks/useCatalogIngredients";
import { isPostgresUniqueViolation } from "../lib/ingredientCategoryMembership";
import type { CatalogIngredientCategory, CatalogIngredientCategorySave } from "../types";

export const CATALOG_INGREDIENT_CATEGORIES_QUERY_KEY = "catalog-ingredient-categories";

type CategoryRow = Omit<CatalogIngredientCategory, "outlet_ids"> & {
  catalog_ingredient_category_outlets?: Array<{ outlet_id: string }> | null;
};

function mapCategory(row: CategoryRow): CatalogIngredientCategory {
  const { catalog_ingredient_category_outlets: outletLinks, ...rest } = row;
  return {
    ...rest,
    outlet_ids: (outletLinks ?? []).map((link) => link.outlet_id),
  };
}

export function useCatalogIngredientCategories() {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [CATALOG_INGREDIENT_CATEGORIES_QUERY_KEY, organizationId],
    queryFn: async (): Promise<CatalogIngredientCategory[]> => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from("catalog_ingredient_categories")
        .select(
          "id, organization_id, name, sort_order, catalog_ingredient_category_outlets(outlet_id)",
        )
        .eq("organization_id", organizationId)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw error;
      return ((data ?? []) as CategoryRow[]).map(mapCategory);
    },
    enabled: !!organizationId,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: [CATALOG_INGREDIENT_CATEGORIES_QUERY_KEY, organizationId] });
    queryClient.invalidateQueries({ queryKey: [CATALOG_INGREDIENTS_QUERY_KEY, organizationId] });
  };

  const save = useMutation({
    mutationFn: async (payload: CatalogIngredientCategorySave): Promise<CatalogIngredientCategory> => {
      if (!organizationId) throw new Error("Organization ID is required");
      const name = payload.name.trim();
      if (!name) throw new Error("ingredient_category_name_required");

      let categoryId = payload.id ?? "";
      let sortOrder = 0;
      const outletIds = payload.id
        ? [...(query.data?.find((row) => row.id === payload.id)?.outlet_ids ?? [])]
        : [];

      if (payload.id) {
        const { error } = await supabase
          .from("catalog_ingredient_categories")
          .update({ name })
          .eq("id", payload.id);
        if (error) {
          if (isPostgresUniqueViolation(error)) throw new Error("ingredient_category_duplicate");
          throw error;
        }
        categoryId = payload.id;
        sortOrder = query.data?.find((row) => row.id === payload.id)?.sort_order ?? 0;
      } else {
        const outletId = payload.outlet_id?.trim() ?? "";
        if (!outletId) throw new Error("ingredient_category_outlet_required");
        const { data, error } = await supabase
          .from("catalog_ingredient_categories")
          .insert({
            organization_id: organizationId,
            name,
            sort_order: (query.data?.length ?? 0) + 1,
          })
          .select("id, sort_order")
          .single();
        if (error) {
          if (isPostgresUniqueViolation(error)) throw new Error("ingredient_category_duplicate");
          throw error;
        }
        categoryId = data.id as string;
        sortOrder = data.sort_order ?? 0;
        const { error: outletError } = await supabase.from("catalog_ingredient_category_outlets").insert({
          category_id: categoryId,
          outlet_id: outletId,
          organization_id: organizationId,
        });
        if (outletError) throw outletError;
        outletIds.push(outletId);
      }

      return {
        id: categoryId,
        organization_id: organizationId,
        name,
        sort_order: sortOrder,
        outlet_ids: Array.from(new Set(outletIds)),
      };
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("catalog_ingredient_categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return {
    rows: query.data ?? [],
    isLoading: query.isLoading,
    save: save.mutateAsync,
    remove: remove.mutateAsync,
    isSaving: save.isPending || remove.isPending,
  };
}
