import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import type { CatalogOption, LabCatalog } from "@/thinking-lab/master-thought/catalog";

function option(id: unknown, name: unknown): CatalogOption | null {
  if (typeof id !== "string" || typeof name !== "string") return null;
  const text = name.trim();
  return text ? { id, name: text } : null;
}

/** Active categories of the organization, each with its sub-categories and Product Knowledge features. */
export function useLabCatalogs(organizationId: string | null) {
  return useQuery({
    queryKey: ["thinking-lab-catalogs", organizationId],
    enabled: Boolean(organizationId),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<LabCatalog[]> => {
      const services = await supabase
        .from("services")
        .select("id, name")
        .eq("organization_id", organizationId as string)
        .eq("is_active", true)
        .order("name")
        .limit(200);
      if (services.error) throw services.error;
      const categories = (services.data ?? []).flatMap((row) => {
        const item = option(row?.id, row?.name);
        return item ? [item] : [];
      });
      if (categories.length === 0) return [];
      const ids = categories.map((item) => item.id);
      const [subs, features] = await Promise.all([
        supabase.from("sub_services").select("id, name, service_id").in("service_id", ids).order("name"),
        supabase
          .from("product_knowledge_features")
          .select("id, feature_name, service_id")
          .eq("organization_id", organizationId as string)
          .in("service_id", ids)
          .order("feature_name"),
      ]);
      if (subs.error) throw subs.error;
      if (features.error) throw features.error;
      return categories.map((category) => ({
        ...category,
        subCategories: (subs.data ?? []).flatMap((row) => {
          const item = row?.service_id === category.id ? option(row.id, row.name) : null;
          return item ? [item] : [];
        }),
        features: (features.data ?? []).flatMap((row) => {
          const item = row?.service_id === category.id ? option(row.id, row.feature_name) : null;
          return item ? [item] : [];
        }),
      }));
    },
  });
}
