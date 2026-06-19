import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import type { PayrollExpenseSettings } from "../types/payrollExpense";

export function payrollExpenseSettingsQueryKey(organizationId: string | null | undefined) {
  return ["payroll-expense-settings", organizationId] as const;
}

export function usePayrollExpenseSettings(organizationId: string | null | undefined) {
  return useQuery({
    queryKey: payrollExpenseSettingsQueryKey(organizationId),
    queryFn: async (): Promise<PayrollExpenseSettings | null> => {
      if (!organizationId) return null;
      const { data, error } = await supabase
        .from("organization_payroll_expense_settings")
        .select("*")
        .eq("organization_id", organizationId)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        return {
          organization_id: organizationId,
          is_enabled: false,
          expense_type_name: "Fixed Expenses",
          expense_category_name: "Gaji Karyawan Tetap",
          department: "Finance",
        };
      }
      return data as PayrollExpenseSettings;
    },
    enabled: Boolean(organizationId),
  });
}

export function useInvalidatePayrollExpenseSettings() {
  const queryClient = useQueryClient();
  return (organizationId: string) => {
    void queryClient.invalidateQueries({
      queryKey: payrollExpenseSettingsQueryKey(organizationId),
    });
  };
}
