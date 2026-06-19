export type PayrollExpenseSettingsRow = {
  organization_id: string;
  is_enabled: boolean;
  expense_type_name: string;
  expense_category_name: string;
  department: string;
  updated_at?: string;
  updated_by?: string | null;
};

export type PayrollThpExpensePostResult = {
  ok: boolean;
  expense_id?: string;
  amount?: number;
  employee_count?: number;
  skipped?: boolean;
  reason?: string;
  error?: string;
};

export type PayrollExpenseClassification = {
  type_id: string;
  type_name: string;
  category_id: string;
  category_name: string;
};
