import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";

/** Shared with LeadsFilters + LeadsTableNew; one network fetch via React Query. */
export const LEADS_MANAGEMENT_ACTIVE_STATUSES_QUERY_KEY = [
  "leads-management",
  "lead-statuses-active-full",
] as const;

export function useLeadStatusesActiveFull() {
  return useQuery({
    queryKey: LEADS_MANAGEMENT_ACTIVE_STATUSES_QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_statuses")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Filter metadata for Leads Management (same sources as former LeadsFilters useEffect).
 * Subscribes to the same queries from any caller — TanStack Query dedupes the fetch.
 */
export function useLeadsManagementFilterQueries() {
  const leadStatuses = useLeadStatusesActiveFull();
  const leadSources = useQuery({
    queryKey: ["leads-management", "lead-sources-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_sources")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });
  const services = useQuery({
    queryKey: ["leads-management", "services-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });
  const subServices = useQuery({
    queryKey: ["leads-management", "sub-services-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sub_services")
        .select("id, name, service_id")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const metadataPending =
    leadStatuses.isPending ||
    leadSources.isPending ||
    services.isPending ||
    subServices.isPending;

  const filtersLoadError =
    leadStatuses.isError || leadSources.isError || services.isError || subServices.isError
      ? "Gagal memuat data filter"
      : null;

  return {
    leadStatuses: (leadStatuses.data ?? []) as Array<{
      id: string;
      name: string;
      description?: string;
      color: string;
    }>,
    leadSources: (leadSources.data ?? []) as Array<{ id: string; name: string; description?: string }>,
    services: (services.data ?? []) as Array<{ id: string; name: string }>,
    subServices: (subServices.data ?? []) as Array<{ id: string; name: string; service_id: string }>,
    metadataPending,
    filtersLoadError,
  };
}
