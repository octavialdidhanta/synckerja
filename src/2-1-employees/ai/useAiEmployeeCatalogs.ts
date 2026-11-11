import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";

export function aiEmployeeCatalogsQueryKey(organizationId: string | null | undefined) {
  return ["ai-employee-office-catalogs", organizationId ?? ""] as const;
}

export function useAiEmployeeCatalogs(organizationId?: string | null) {
  return useQuery({
    queryKey: aiEmployeeCatalogsQueryKey(organizationId),
    enabled: Boolean(organizationId),
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<Map<string, string>> => {
      if (!organizationId) return new Map();
      const { data, error } = await supabase.rpc("ai_employee_office_catalogs", {
        p_organization_id: organizationId,
      });
      if (error) throw error;
      const catalogs = new Map<string, string>();
      for (const row of data ?? []) {
        const employeeId = typeof row.employee_id === "string" ? row.employee_id : "";
        const name = typeof row.catalog_name === "string" ? row.catalog_name.trim() : "";
        if (employeeId && name) catalogs.set(employeeId, name);
      }
      return catalogs;
    },
  });
}
