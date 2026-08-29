import { useQuery } from "@tanstack/react-query";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { supabase } from "@/shared/lib/supabaseClient";
import { resolvePosCashierDisplayName } from "./resolvePosCashierDisplayName";
import { POS_CASHIER_SHIFTS_QUERY_KEY } from "./usePosCashierShift";

export const POS_SHIFT_CASHIER_NAME_QUERY_KEY = "pos-shift-cashier-name";

/**
 * Resolve cashier display name for a shift opener / user id.
 * Prefers employees.full_name (Employees Staff), then profiles.full_name.
 */
export function usePosShiftCashierName(
  userId: string | null | undefined,
  emailFallback?: string | null,
) {
  const { organizationId } = useCurrentOrg();

  const query = useQuery({
    queryKey: [
      POS_CASHIER_SHIFTS_QUERY_KEY,
      POS_SHIFT_CASHIER_NAME_QUERY_KEY,
      organizationId,
      userId,
    ],
    enabled: Boolean(organizationId && userId),
    staleTime: 60_000,
    queryFn: async () => {
      if (!organizationId || !userId) {
        return { employeeFullName: null as string | null, profileFullName: null as string | null };
      }

      const [empRes, profRes] = await Promise.all([
        supabase
          .from("employees")
          .select("full_name")
          .eq("organization_id", organizationId)
          .eq("user_id", userId)
          .maybeSingle(),
        supabase
          .from("profiles")
          .select("full_name")
          .eq("user_id", userId)
          .maybeSingle(),
      ]);

      if (empRes.error) throw empRes.error;
      if (profRes.error) throw profRes.error;

      return {
        employeeFullName:
          (empRes.data as { full_name?: string | null } | null)?.full_name ?? null,
        profileFullName:
          (profRes.data as { full_name?: string | null } | null)?.full_name ?? null,
      };
    },
  });

  const name = resolvePosCashierDisplayName({
    employeeFullName: query.data?.employeeFullName,
    profileFullName: query.data?.profileFullName,
    email: emailFallback,
  });

  const isLoading = query.isLoading && !query.data;

  return {
    name: isLoading ? "…" : name,
    isLoading,
    resolvedName: name,
  };
}
