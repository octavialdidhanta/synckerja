import { useQuery } from "@tanstack/react-query";
import { socialMediaInsightQueryKeys } from "@/6-0-social-media-performance-shared/socialMediaInsightQueryKeys";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { supabase } from "@/shared/lib/supabaseClient";

export function useInsightLinkedIndividualObjectiveIds() {
  const { organizationId } = useCurrentOrg();

  return useQuery({
    queryKey: socialMediaInsightQueryKeys.linkedIndividualObjectiveIds(organizationId),
    queryFn: async (): Promise<Set<string>> => {
      if (!organizationId) return new Set();

      const { data, error } = await supabase
        .from("social_media_insight_targets")
        .select("individual_objective_id")
        .eq("organization_id", organizationId)
        .not("individual_objective_id", "is", null);

      if (error) throw error;

      const ids = new Set<string>();
      for (const row of data ?? []) {
        if (row.individual_objective_id) ids.add(row.individual_objective_id);
      }
      return ids;
    },
    enabled: Boolean(organizationId),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
