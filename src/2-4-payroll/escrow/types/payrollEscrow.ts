export type PayrollEscrowSettings = {
  organization_id: string;
  is_enabled: boolean;
  escrow_sub_account_row_id: string | null;
  require_xendit_disburse: boolean;
  updated_at?: string;
  updated_by?: string | null;
};

export type PayrollEscrowTransferStatus = "pending" | "completed" | "failed" | "skipped";

export type PayrollEscrowTransfer = {
  id: string;
  organization_id: string;
  payroll_run_id: string;
  source_sub_account_row_id: string;
  dest_sub_account_row_id: string;
  amount_pph21: number;
  amount_bpjs_kesehatan: number;
  amount_bpjs_pensiun: number;
  amount_total: number;
  xendit_transfer_id: string | null;
  reference: string;
  status: PayrollEscrowTransferStatus;
  failure_code: string | null;
  failure_message: string | null;
  initiated_by: string | null;
  created_at: string;
  completed_at: string | null;
};

export type StatutoryEscrowAmounts = {
  success: boolean;
  message?: string;
  amount_pph21: number;
  amount_bpjs_kesehatan: number;
  amount_bpjs_pensiun: number;
  amount_total: number;
};

export const STATUTORY_ESCROW_CATEGORIES = ["pph21", "bpjs_kesehatan", "bpjs_pensiun"] as const;
