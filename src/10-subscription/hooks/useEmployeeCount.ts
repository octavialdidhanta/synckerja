import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import { useActiveOrganization } from "@/10-subscription/shared/useActiveOrganization";

export function useEmployeeCount() {
  const { organizationId } = useActiveOrganization();

  return useQuery({
    queryKey: ["employee-count", organizationId],
    queryFn: async () => {
      if (!organizationId) return 0;
      const { data, error } = await supabase
        .from("employees")
        .select("id, employee_status_id, pending_removal")
        .eq("organization_id", organizationId);
      if (error) throw error;
      const statusIds = Array.from(
        new Set((data ?? []).map((e: { employee_status_id?: string }) => e.employee_status_id).filter(Boolean)),
      ) as string[];
      let activeStatusIds = new Set<string>();
      if (statusIds.length > 0) {
        const { data: statusRows } = await supabase
          .from("employee_statuses")
          .select("id, name")
          .in("id", statusIds);
        activeStatusIds = new Set(
          (statusRows ?? [])
            .filter((s: { name?: string }) => ["active", "probation"].includes(String(s.name || "").toLowerCase()))
            .map((s: { id: string }) => s.id),
        );
      }
      return (data ?? []).filter((e: { pending_removal?: boolean; employee_status_id?: string }) => {
        if (e.pending_removal === true) return false;
        if (!e.employee_status_id) return true;
        return activeStatusIds.has(e.employee_status_id);
      }).length;
    },
    enabled: !!organizationId,
    staleTime: 30 * 1000,
    gcTime: 2 * 60 * 1000,
  });
}
