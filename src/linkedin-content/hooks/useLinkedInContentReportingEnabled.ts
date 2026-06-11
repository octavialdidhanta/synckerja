import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";

export function useLinkedInContentReportingEnabled(organizationId: string | null | undefined) {
  return useQuery({
    queryKey: ["linkedin-content-reporting-enabled", organizationId],
    queryFn: async () => {
      if (!organizationId) return false;
      const { data, error } = await supabase.rpc("is_linkedin_content_reporting_enabled", {
        p_organization_id: organizationId,
      });
      if (error) {
        console.error("is_linkedin_content_reporting_enabled:", error.message);
        return false;
      }
      return data === true;
    },
    enabled: Boolean(organizationId),
    staleTime: 60_000,
  });
}
