import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import type { PayrollEscrowSettings } from "../types/payrollEscrow";

export function payrollEscrowSettingsQueryKey(organizationId: string | null | undefined) {
  return ["payroll-escrow-settings", organizationId] as const;
}

export function usePayrollEscrowSettings(organizationId: string | null | undefined) {
  return useQuery({
    queryKey: payrollEscrowSettingsQueryKey(organizationId),
    queryFn: async (): Promise<PayrollEscrowSettings | null> => {
      if (!organizationId) return null;
      const { data, error } = await supabase
        .from("organization_payroll_escrow_settings")
        .select("*")
        .eq("organization_id", organizationId)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        return {
          organization_id: organizationId,
          is_enabled: false,
          escrow_sub_account_row_id: null,
          require_xendit_disburse: true,
        };
      }
      return data as PayrollEscrowSettings;
    },
    enabled: Boolean(organizationId),
  });
}

export function useInvalidatePayrollEscrowSettings() {
  const queryClient = useQueryClient();
  return (organizationId: string) => {
    void queryClient.invalidateQueries({
      queryKey: payrollEscrowSettingsQueryKey(organizationId),
    });
  };
}
