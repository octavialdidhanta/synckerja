import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import type { PayrollEscrowTransfer, StatutoryEscrowAmounts } from "../types/payrollEscrow";

export function payrollEscrowTransferQueryKey(runId: string | null | undefined) {
  return ["payroll-escrow-transfer", runId] as const;
}

export function payrollEscrowAmountsQueryKey(runId: string | null | undefined) {
  return ["payroll-escrow-amounts", runId] as const;
}

export function usePayrollEscrowTransferStatus(runId: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: payrollEscrowTransferQueryKey(runId),
    queryFn: async (): Promise<PayrollEscrowTransfer | null> => {
      if (!runId) return null;
      const { data, error } = await supabase
        .from("payroll_xendit_escrow_transfers")
        .select("*")
        .eq("payroll_run_id", runId)
        .maybeSingle();
      if (error) throw error;
      return (data as PayrollEscrowTransfer | null) ?? null;
    },
    enabled: Boolean(runId) && enabled,
  });
}

export function usePayrollEscrowAmounts(runId: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: payrollEscrowAmountsQueryKey(runId),
    queryFn: async (): Promise<StatutoryEscrowAmounts> => {
      if (!runId) {
        return {
          success: false,
          amount_pph21: 0,
          amount_bpjs_kesehatan: 0,
          amount_bpjs_pensiun: 0,
          amount_total: 0,
        };
      }
      const { data, error } = await supabase.rpc("get_payroll_statutory_escrow_amounts", {
        p_run_id: runId,
      });
      if (error) throw error;
      const row = (data ?? {}) as Record<string, unknown>;
      return {
        success: row.success !== false,
        message: row.message != null ? String(row.message) : undefined,
        amount_pph21: Number(row.amount_pph21) || 0,
        amount_bpjs_kesehatan: Number(row.amount_bpjs_kesehatan) || 0,
        amount_bpjs_pensiun: Number(row.amount_bpjs_pensiun) || 0,
        amount_total: Number(row.amount_total) || 0,
      };
    },
    enabled: Boolean(runId) && enabled,
  });
}
