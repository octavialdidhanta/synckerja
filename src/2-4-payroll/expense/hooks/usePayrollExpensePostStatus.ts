import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import type { PayrollExpensePostStatus } from "../types/payrollExpense";

export function payrollExpensePostQueryKey(runId: string | null | undefined) {
  return ["payroll-expense-post", runId] as const;
}

export function usePayrollExpensePostStatus(runId: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: payrollExpensePostQueryKey(runId),
    queryFn: async (): Promise<PayrollExpensePostStatus> => {
      if (!runId) return { status: "none" };

      const { data: expense, error: expenseErr } = await supabase
        .from("expenses")
        .select("id, amount")
        .eq("payroll_run_id", runId)
        .maybeSingle();
      if (expenseErr) throw expenseErr;

      if (expense?.id) {
        return {
          status: "posted",
          expense_id: String(expense.id),
          amount: Number(expense.amount) || 0,
        };
      }

      const { data: audits, error: auditErr } = await supabase
        .from("payroll_audit_log")
        .select("action, metadata, created_at")
        .eq("payroll_run_id", runId)
        .in("action", ["payroll_expense_post_failed", "payroll_expense_post_skipped"])
        .order("created_at", { ascending: false })
        .limit(1);
      if (auditErr) throw auditErr;

      const latest = audits?.[0];
      if (!latest) return { status: "none" };

      const meta = (latest.metadata ?? {}) as Record<string, unknown>;
      if (latest.action === "payroll_expense_post_failed") {
        const reason = String(meta.reason ?? "missing_classification");
        return {
          status: "failed",
          reason,
          failure_message:
            reason === "missing_expense_type"
              ? String(meta.expense_type_name ?? "Fixed Expenses")
              : reason === "missing_expense_category"
                ? String(meta.expense_category_name ?? "Gaji Karyawan Tetap")
                : reason,
        };
      }

      return {
        status: "skipped",
        reason: meta.reason != null ? String(meta.reason) : undefined,
      };
    },
    enabled: Boolean(runId) && enabled,
  });
}
