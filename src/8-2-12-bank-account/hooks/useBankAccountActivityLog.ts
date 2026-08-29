import { useQuery } from "@tanstack/react-query";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { supabase } from "@/shared/lib/supabaseClient";
import type { BankAccountActivityLog } from "../lib/bankAccountActivity";

export function useBankAccountActivityLog(enabled = true) {
  const { organizationId } = useCurrentOrg();

  const query = useQuery({
    queryKey: ["bank-account-activity", organizationId],
    enabled: Boolean(organizationId && enabled),
    queryFn: async (): Promise<BankAccountActivityLog[]> => {
      const { data, error } = await supabase
        .from("bank_account_activity_logs")
        .select(
          "id, organization_id, bank_account_id, action, summary, meta, actor_user_id, created_at",
        )
        .eq("organization_id", organizationId!)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as BankAccountActivityLog[];
    },
  });

  return {
    logs: query.data ?? [],
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}
