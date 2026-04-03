import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { useMemo } from "react";

interface ServiceRow {
  id: string;
  name: string;
  organization_id?: string | null;
}

interface SubServiceRow {
  id: string;
  name: string;
  service_id: string;
  organization_id?: string | null;
}

export function useDefaultPriceServiceOptions() {
  const { organizationId } = useCurrentOrg();

  const servicesQuery = useQuery({
    queryKey: ["services", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];

      const { data, error } = await supabase
        .from("services")
        .select("*")
        .or(`organization_id.eq.${organizationId},organization_id.is.null`)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return data as ServiceRow[];
    },
    enabled: !!organizationId,
  });

  const subServicesQuery = useQuery({
    queryKey: ["sub-services", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];

      const { data, error } = await supabase
        .from("sub_services")
        .select("*")
        .or(`organization_id.eq.${organizationId},organization_id.is.null`)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return data as SubServiceRow[];
    },
    enabled: !!organizationId,
  });

  const services = servicesQuery.data ?? [];
  const subServices = subServicesQuery.data ?? [];

  const getSubServicesByService = useMemo(
    () => (serviceId: string) => subServices.filter((s) => s.service_id === serviceId),
    [subServices],
  );

  const isLoading = servicesQuery.isLoading || subServicesQuery.isLoading;

  return {
    services,
    subServices,
    getSubServicesByService,
    isLoading,
  };
}
