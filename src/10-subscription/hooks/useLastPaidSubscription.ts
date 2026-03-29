import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";

export function useLastPaidSubscription(organizationId: string | undefined) {
  const { data, isLoading } = useQuery({
    queryKey: ["last-paid-subscription", organizationId],
    queryFn: async () => {
      if (!organizationId) return { lastPaidAmount: null as number | null, lastPaidMemberCount: null as number | null };
      const { data: rows, error } = await supabase
        .from("payments")
        .select("amount, member_count")
        .eq("organization_id", organizationId)
        .in("status", ["success", "settlement", "paid"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!rows || rows.amount == null) {
        return { lastPaidAmount: null as number | null, lastPaidMemberCount: null as number | null };
      }
      return {
        lastPaidAmount: Number(rows.amount),
        lastPaidMemberCount: rows.member_count != null ? Number(rows.member_count) : null,
      };
    },
    enabled: !!organizationId,
    refetchOnWindowFocus: false,
  });

  return {
    lastPaidAmount: data?.lastPaidAmount ?? null,
    lastPaidMemberCount: data?.lastPaidMemberCount ?? null,
    isLoading,
  };
}
