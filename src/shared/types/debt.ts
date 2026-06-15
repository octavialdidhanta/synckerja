export interface Debt {
  id: string;
  organization_id: string;
  debt_name: string;
  debt_type: string;
  bank_name?: string;
  limit_amount: number;
  available_limit?: number;
  debt_amount: number;
  paid_amount?: number;
  remaining_debt?: number;
  total_interest?: number;
  loan_duration?: number;
  monthly_payment?: number;
  interest_rate?: number;
  due_date?: string;
  last_payment_date?: string | null;
  minimum_payment?: number;
  description?: string;
  status: "active" | "paid_off" | "closed";
  brick_connection_id?: string | null;
  brick_aggregated_account_id?: string | null;
  brick_link_status?: "unlinked" | "pending" | "linked" | "error";
  brick_last_sync_at?: string | null;
  brick_last_sync_error?: string | null;
  brick_auto_import?: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CreateDebtData {
  debt_name: string;
  debt_type: string;
  bank_name?: string;
  limit_amount: number;
  available_limit?: number;
  debt_amount: number;
  paid_amount?: number;
  loan_duration?: number;
  monthly_payment?: number;
  interest_rate?: number;
  due_date?: string;
  minimum_payment?: number;
  description?: string;
  status?: "active" | "paid_off" | "closed";
}

export interface UpdateDebtData extends Partial<CreateDebtData> {
  id: string;
}

export const DEBT_TYPES = [
  "Kartu Kredit",
  "Pinjaman Bank",
  "Hutang Supplier",
  "Pinjaman Online",
  "Hutang Pribadi",
  "Lainnya",
] as const;

export type DebtType = (typeof DEBT_TYPES)[number];
