import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/shared/lib/supabaseClient";
import { logger } from "@/shared/lib/logger";
import { globalCompanyObjectivesManager } from "@/shared/hooks/globalCompanyObjectivesManager";

export interface CompanyObjective {
  id: string;
  organization_id: string;
  cycle_id: string;
  title: string;
  why_important?: string;
  status: "draft" | "active" | "completed" | "cancelled";
  progress_percentage: number;
  weight: number;
  start_date?: string;
  end_date?: string;
  owner_id: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export const useCompanyObjectives = (organizationId?: string, _cycleIds?: string[]) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!organizationId) return;
    return globalCompanyObjectivesManager.subscribe(organizationId, queryClient);
  }, [organizationId, queryClient]);

  return useQuery({
    queryKey: ["company-objectives", organizationId],
    queryFn: async () => {
      if (!organizationId) {
        return [];
      }
      const startTime = performance.now();
      const { data, error } = await supabase
        .from("company_objectives")
        .select(
          "id, organization_id, cycle_id, title, why_important, status, progress_percentage, weight, start_date, end_date, owner_id, created_by, created_at, updated_at",
        )
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false });
      const duration = performance.now() - startTime;
      logger.performance(`Company Objectives Fetch (${organizationId})`, duration, 5000);

      if (error) {
        throw error;
      }
      return data || [];
    },
    enabled: !!organizationId,
    staleTime: 120 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    gcTime: 5 * 60 * 1000,
  });
};
