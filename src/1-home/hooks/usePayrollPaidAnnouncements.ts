import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";

export type PayrollPaidAnnouncementRow = {
  id: string;
  period_label: string;
  bank_name: string | null;
  account_last4: string | null;
  finance_tip_key: string;
  expires_at: string;
  created_at: string;
};

export function usePayrollPaidAnnouncements() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["payroll-paid-announcements"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_active_payroll_paid_announcements");
      if (error) throw error;
      return (data ?? []) as PayrollPaidAnnouncementRow[];
    },
    staleTime: 60_000,
  });

  const dismiss = useCallback(
    async (announcementId: string) => {
      const { data, error } = await supabase.rpc("dismiss_payroll_paid_announcement", {
        p_announcement_id: announcementId,
      });
      if (error) throw error;
      const result = data as { success?: boolean };
      if (!result?.success) {
        throw new Error("Failed to dismiss announcement");
      }
      await queryClient.invalidateQueries({ queryKey: ["payroll-paid-announcements"] });
    },
    [queryClient],
  );

  return {
    announcements: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    dismiss,
    refetch: query.refetch,
  };
}
