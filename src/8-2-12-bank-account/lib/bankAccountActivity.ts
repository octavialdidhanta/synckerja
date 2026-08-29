export type BankAccountActivityAction =
  | "create"
  | "update"
  | "deactivate"
  | "assign_outlets";

export type BankAccountActivityLog = {
  id: string;
  organization_id: string;
  bank_account_id: string | null;
  action: BankAccountActivityAction;
  summary: string;
  meta: Record<string, unknown>;
  actor_user_id: string | null;
  created_at: string;
};
