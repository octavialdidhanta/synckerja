
export interface IncomeTransaction {
  id: string;
  organization_id: string;
  user_id: string;
  transaction_date: string;
  amount: number;
  customer_name?: string;
  payment_method?: string;
  bank_account_id?: string;
  income_type_id?: string;
  category_id?: string;
  service_id?: string;
  sub_service_id?: string;
  is_recurring: boolean;
  recurring_frequency?: string;
  description?: string;
  receipt_file_path?: string;
  receipt_file_name?: string;
  receipt_file_size?: number;
  receipt_mime_type?: string;
  /** External ref from receipt (share flow); unique per org when set. */
  transaction_reference?: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface IncomeTransactionWithRelations extends IncomeTransaction {
  /** Sum of `income_allocations.amount` for this row (server-enriched in hook). */
  allocated_amount?: number;
  /** True when allocated_amount > 0. */
  has_income_allocations?: boolean;
  /** Legacy inter-bank transfer: linked from `bank_transfer_journals.income_transaction_id`. */
  is_legacy_bank_transfer_income?: boolean;
  income_types?: {
    name: string;
  };
  income_categories?: {
    name: string;
  };
  services?: {
    name: string;
  };
  sub_services?: {
    name: string;
  };
  /** Joined from `bank_accounts` via `bank_account_id` */
  bank_accounts?: {
    id: string;
    name: string;
    bank_name: string | null;
    account_number: string | null;
    account_holder: string | null;
  } | null;
}

export interface CreateIncomeTransactionData {
  transaction_date: string;
  amount: number;
  customer_name?: string;
  payment_method?: string;
  bank_account_id?: string;
  income_type_id?: string;
  category_id?: string;
  /** For income type "Other": user-entered label; stored as income_categories row on create. */
  custom_category_name?: string;
  service_id?: string;
  sub_service_id?: string;
  is_recurring?: boolean;
  recurring_frequency?: string;
  description?: string;
  receipt_file?: File;
  receipt_url?: string;
  transaction_reference?: string | null;
}
