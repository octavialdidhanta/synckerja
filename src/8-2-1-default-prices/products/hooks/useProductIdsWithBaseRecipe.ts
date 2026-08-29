import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { fetchProductIdsWithBaseRecipe } from "@/stock-management/stock-commit/lib/recipe/fetchProductIdsWithBaseRecipe";

/** Product ids that have a base recipe (modifier_option_id IS NULL). */
export function useProductIdsWithBaseRecipe(productIds: string[]) {
  const { organizationId } = useCurrentOrg();
  const ids = [...new Set(productIds.filter(Boolean))].sort();

  return useQuery({
    queryKey: ["product-ids-with-base-recipe", organizationId, ids.join(",")],
    enabled: Boolean(organizationId) && ids.length > 0,
    staleTime: 30_000,
    queryFn: async (): Promise<Set<string>> => {
      if (!organizationId) return new Set();
      return fetchProductIdsWithBaseRecipe({ organizationId, productIds: ids });
    },
  });
}
