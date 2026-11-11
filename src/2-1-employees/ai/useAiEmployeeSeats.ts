import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";

export type AiEmployeeSeats = {
  allowance: number;
  active: number;
  remaining: number;
};

export function aiEmployeeSeatsQueryKey(organizationId: string | null | undefined) {
  return ["ai-employee-seats", organizationId ?? ""] as const;
}

export function useAiEmployeeSeats(organizationId?: string | null) {
  return useQuery({
    queryKey: aiEmployeeSeatsQueryKey(organizationId),
    enabled: Boolean(organizationId),
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<AiEmployeeSeats> => {
      if (!organizationId) return { allowance: 0, active: 0, remaining: 0 };
      const [allowanceRes, activeRes] = await Promise.all([
        supabase.rpc("ai_employee_seat_allowance", { p_org_id: organizationId }),
        supabase.rpc("count_active_ai_employees_for_org", { p_org_id: organizationId }),
      ]);
      if (allowanceRes.error) throw allowanceRes.error;
      if (activeRes.error) throw activeRes.error;
      const allowance = Math.max(0, Number(allowanceRes.data ?? 0) || 0);
      const active = Math.max(0, Number(activeRes.data ?? 0) || 0);
      return { allowance, active, remaining: Math.max(0, allowance - active) };
    },
  });
}
