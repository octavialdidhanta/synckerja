import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";

export type LabCatalog = {
  id: string;
  name: string;
};

export function useLabCatalogs(organizationId: string | null) {
  return useQuery({
    queryKey: ["thinking-lab-catalogs", organizationId],
    enabled: Boolean(organizationId),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<LabCatalog[]> => {
      const { data, error } = await supabase
        .from("services")
        .select("id, name")
        .eq("organization_id", organizationId as string)
        .eq("is_active", true)
        .order("name")
        .limit(200);
      if (error) throw error;
      return (data ?? []).flatMap((row) => {
        if (!row || typeof row.id !== "string" || typeof row.name !== "string") return [];
        const name = row.name.trim();
        return name ? [{ id: row.id, name }] : [];
      });
    },
  });
}
