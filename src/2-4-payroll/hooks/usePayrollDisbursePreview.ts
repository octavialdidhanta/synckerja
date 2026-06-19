import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import { isKnownPayrollBank } from "@/shared/lib/payroll/payrollBankCodes";

export type PayrollDisbursePreviewIssue =
  | "missing_bank"
  | "invalid_amount"
  | "already_processing"
  | "failed_previous"
  | "already_paid"
  | "snapshot_drift"
  | "unknown_bank";

export type PayrollDisbursePeriodSeverity =
  | "unavailable"
  | "stable"
  | "moderate"
  | "significant_increase"
  | "significant_decrease";

export type PayrollDisbursePeriodComparison = {
  available: boolean;
  previous_period_id?: string;
  previous_period_name?: string;
  previous_run_id?: string;
  previous_run_status?: string;
  previous_total_thp?: number;
  previous_employee_count?: number;
  current_total_thp?: number;
  current_employee_count?: number;
  matched_employee_count?: number;
  matched_previous_thp?: number;
  matched_current_thp?: number;
  delta_amount?: number;
  delta_percent?: number | null;
  matched_delta_amount?: number;
  matched_delta_percent?: number | null;
  severity: PayrollDisbursePeriodSeverity;
  requires_review_ack: boolean;
};

export type PayrollDisbursePreviewEmployee = {
  calculation_id: string;
  employee_name: string | null;
  employee_code: string | null;
  bank_name: string | null;
  account_number: string | null;
  account_holder: string | null;
  take_home_pay: number;
  payment_status: string;
  issues: PayrollDisbursePreviewIssue[];
  eligible: boolean;
};

export type PayrollDisbursePreviewSummary = {
  count_pending: number;
  count_invalid: number;
  count_processing: number;
  count_failed: number;
  count_paid: number;
  total_thp_pending: number;
  total_thp_all: number;
  has_active_disbursement: boolean;
};

export type PayrollDisbursePreview = {
  success: boolean;
  message?: string;
  run_id?: string;
  run_name?: string;
  run_status?: string;
  employees: PayrollDisbursePreviewEmployee[];
  summary: PayrollDisbursePreviewSummary;
  period_comparison?: PayrollDisbursePeriodComparison;
};

function computeSeverity(deltaPercent: number | null): {
  severity: PayrollDisbursePeriodSeverity;
  requires_review_ack: boolean;
} {
  if (deltaPercent === null) {
    return { severity: "unavailable", requires_review_ack: false };
  }
  if (deltaPercent >= 15) {
    return { severity: "significant_increase", requires_review_ack: true };
  }
  if (deltaPercent <= -15) {
    return { severity: "significant_decrease", requires_review_ack: true };
  }
  if (Math.abs(deltaPercent) >= 5) {
    return { severity: "moderate", requires_review_ack: false };
  }
  return { severity: "stable", requires_review_ack: false };
}

function enrichPeriodComparison(
  raw: PayrollDisbursePeriodComparison | undefined,
  currentTotalThp: number,
  currentEmployeeCount: number,
): PayrollDisbursePeriodComparison {
  if (!raw?.available || raw.previous_total_thp == null) {
    return {
      available: false,
      severity: raw?.severity ?? "unavailable",
      requires_review_ack: false,
      previous_period_name: raw?.previous_period_name,
    };
  }

  const delta_amount = currentTotalThp - raw.previous_total_thp;
  const delta_percent =
    raw.previous_total_thp > 0
      ? Math.round((delta_amount / raw.previous_total_thp) * 10000) / 100
      : null;
  const { severity, requires_review_ack } = computeSeverity(delta_percent);

  return {
    ...raw,
    current_total_thp: currentTotalThp,
    current_employee_count: currentEmployeeCount,
    delta_amount,
    delta_percent,
    severity,
    requires_review_ack,
  };
}

function enrichIssues(employees: PayrollDisbursePreviewEmployee[]): PayrollDisbursePreviewEmployee[] {
  return employees.map((row) => {
    const issues = [...row.issues];
    if (row.bank_name && !isKnownPayrollBank(row.bank_name) && !issues.includes("unknown_bank")) {
      issues.push("unknown_bank");
    }
    const eligible =
      row.payment_status === "pending" &&
      issues.filter((i) => i !== "snapshot_drift").length === 0;
    return { ...row, issues, eligible };
  });
}

export function usePayrollDisbursePreview(runId: string | null, enabled = true) {
  return useQuery({
    queryKey: ["payroll-disburse-preview", runId],
    queryFn: async (): Promise<PayrollDisbursePreview | null> => {
      if (!runId) return null;
      const { data, error } = await supabase.rpc("get_payroll_disburse_preview", {
        p_run_id: runId,
      });
      if (error) throw error;
      const raw = data as PayrollDisbursePreview | { success: false; message: string };
      if (!raw || raw.success === false) {
        throw new Error((raw as { message?: string })?.message ?? "Preview failed");
      }
      const employees = enrichIssues(raw.employees ?? []);
      const count_pending = employees.filter((e) => e.eligible).length;
      const count_invalid = employees.filter(
        (e) => e.payment_status === "pending" && !e.eligible,
      ).length;
      const total_thp_pending = employees
        .filter((e) => e.eligible)
        .reduce((sum, e) => sum + Number(e.take_home_pay ?? 0), 0);
      const period_comparison = enrichPeriodComparison(
        raw.period_comparison,
        total_thp_pending,
        count_pending,
      );
      return {
        ...raw,
        employees,
        summary: {
          ...raw.summary,
          count_pending,
          count_invalid,
          total_thp_pending,
        },
        period_comparison,
      };
    },
    enabled: Boolean(runId) && enabled,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}
