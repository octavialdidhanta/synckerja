import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import type { CatalogProductCategory } from "../types/catalogProductCategory";

export function useCatalogProductCategories() {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["catalog-product-categories", organizationId],
    queryFn: async (): Promise<CatalogProductCategory[]> => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from("catalog_product_categories")
        .select("id, organization_id, name, sort_order, is_active")
        .eq("organization_id", organizationId)
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as CatalogProductCategory[];
    },
    enabled: !!organizationId,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["catalog-product-categories", organizationId] });
    queryClient.invalidateQueries({ queryKey: ["default-prices", organizationId] });
    queryClient.invalidateQueries({ queryKey: ["customer-visit-catalog", organizationId] });
  };

  const create = useMutation({
    mutationFn: async (name: string) => {
      if (!organizationId) throw new Error("Organization ID is required");
      const trimmed = name.trim();
      if (!trimmed) throw new Error("category_name_required");
      const { data, error } = await supabase
        .from("catalog_product_categories")
        .insert({
          organization_id: organizationId,
          name: trimmed,
          sort_order: (query.data?.length ?? 0) + 1,
          is_active: true,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });

  const rename = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const trimmed = name.trim();
      if (!trimmed) throw new Error("category_name_required");
      const { error } = await supabase
        .from("catalog_product_categories")
        .update({ name: trimmed })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("catalog_product_categories")
        .update({ is_active: false })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return {
    rows: query.data ?? [],
    isLoading: query.isLoading,
    create: create.mutateAsync,
    rename: rename.mutateAsync,
    remove: remove.mutateAsync,
    isSaving: create.isPending || rename.isPending || remove.isPending,
  };
}
