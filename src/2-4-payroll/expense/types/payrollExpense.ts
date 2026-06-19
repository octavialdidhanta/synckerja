export type PayrollExpenseSettings = {
  organization_id: string;
  is_enabled: boolean;
  expense_type_name: string;
  expense_category_name: string;
  department: string;
  updated_at?: string;
  updated_by?: string | null;
};

export type PayrollExpensePostStatus = {
  expense_id?: string;
  amount?: number;
  status: "posted" | "failed" | "skipped" | "none";
  reason?: string;
  failure_message?: string;
};
