import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { supabase } from "@/shared/lib/supabaseClient";
import { resolvePosCashierDisplayName } from "@/shared/pos-shift";
import type { ShiftStaffOption } from "../lib/shiftTypes";

export function useShiftStaffOptions() {
  const { organizationId, loading: orgLoading } = useCurrentOrg();

  const query = useQuery({
    queryKey: ["pos-shift-staff-options", organizationId],
    enabled: Boolean(organizationId) && !orgLoading,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<ShiftStaffOption[]> => {
      if (!organizationId) return [];

      const { data: shifts, error: shiftsErr } = await supabase
        .from("pos_cashier_shifts")
        .select("opened_by")
        .eq("organization_id", organizationId)
        .not("opened_by", "is", null);
      if (shiftsErr) throw shiftsErr;

      const userIds = [
        ...new Set(
          (shifts ?? [])
            .map((row) => row.opened_by as string | null)
            .filter(Boolean) as string[],
        ),
      ];
      if (userIds.length === 0) return [];

      const { data: employees, error: empErr } = await supabase
        .from("employees")
        .select("user_id, full_name, email")
        .eq("organization_id", organizationId)
        .in("user_id", userIds);
      if (empErr) throw empErr;

      const { data: profiles, error: profErr } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);
      if (profErr) throw profErr;

      const empByUser = new Map(
        (employees ?? []).map((e) => [String(e.user_id), e as Record<string, unknown>]),
      );
      const profByUser = new Map(
        (profiles ?? []).map((p) => [String(p.id), p as Record<string, unknown>]),
      );

      return userIds
        .map((userId) => {
          const emp = empByUser.get(userId);
          const prof = profByUser.get(userId);
          return {
            userId,
            label: resolvePosCashierDisplayName({
              employeeFullName: emp?.full_name as string | null,
              profileFullName: prof?.full_name as string | null,
              email: (emp?.email ?? prof?.email) as string | null,
            }),
          };
        })
        .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
    },
  });

  const options = useMemo(() => query.data ?? [], [query.data]);

  return {
    options,
    isLoading: orgLoading || query.isLoading,
  };
}
