import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import { usePosOpenShift, POS_CASHIER_SHIFTS_QUERY_KEY } from "@/pos-mobile/4-shift/lib/usePosCashierShift";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";

export type PosShiftWaiterCandidate = {
  userId: string;
  fullName: string;
  roleLabel: string;
};

/** Single waiter candidate = opener of the active cashier shift. */
export function usePosShiftWaiterCandidate(outletId: string | null | undefined) {
  const { organizationId } = useCurrentOrg();
  const openShift = usePosOpenShift(outletId ?? null);
  const openedBy = openShift.data?.opened_by ?? null;

  const profile = useQuery({
    queryKey: [POS_CASHIER_SHIFTS_QUERY_KEY, "waiter-profile", organizationId, openedBy],
    enabled: Boolean(openedBy),
    queryFn: async (): Promise<PosShiftWaiterCandidate | null> => {
      if (!openedBy) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .eq("user_id", openedBy)
        .maybeSingle();
      if (error) throw error;
      const name = String((data as { full_name?: string | null } | null)?.full_name ?? "").trim();
      return {
        userId: openedBy,
        fullName: name || "—",
        roleLabel: "Cashier",
      };
    },
  });

  return {
    waiter: profile.data ?? null,
    shiftOpen: Boolean(openShift.data),
    isLoading: openShift.isLoading || (Boolean(openedBy) && profile.isLoading),
    openShift: openShift.data,
  };
}
