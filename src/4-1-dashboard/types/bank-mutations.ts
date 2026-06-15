export type BrickLinkStatus = 'unlinked' | 'pending' | 'linked' | 'error';

export type BankMutationMatchStatus = 'suggested' | 'confirmed' | 'rejected' | 'expired';

export type BankStatementLine = {
  id: string;
  organization_id: string;
  bank_account_id: string;
  external_id: string;
  transaction_date: string;
  amount: number;
  direction: 'credit' | 'debit';
  description: string | null;
  reference: string | null;
  counterparty_name: string | null;
  origin?: 'brick_sync' | 'brick_va' | 'brick_disbursement' | 'erp_expense' | 'erp_gateway_withdrawal';
  expense_id?: string | null;
  raw_payload?: Record<string, unknown> | null;
  synced_at: string;
  bank_account?: {
    id: string;
    name: string;
    account_number: string | null;
    bank_name: string | null;
    bank_statement_balance: number | null;
  } | null;
  expense?: {
    id: string;
    expense_name: string;
    amount: number;
    purchase_request_id: string | null;
    gateway_wallet_provider: string | null;
    purchase_request?: {
      request_title: string | null;
      paid_at: string | null;
    } | null;
  } | null;
};

export type BankMutationMatch = {
  id: string;
  organization_id: string;
  statement_line_id: string;
  income_transaction_id: string | null;
  sales_activity_payment_id: string | null;
  expense_id: string | null;
  match_score: number;
  match_reason: string | null;
  status: BankMutationMatchStatus;
  confirmed_by: string | null;
  confirmed_at: string | null;
  created_at: string;
  statement_line?: {
    id: string;
    transaction_date: string;
    amount: number;
    direction: 'credit' | 'debit';
    description: string | null;
    reference: string | null;
    counterparty_name: string | null;
    bank_account_id: string;
  } | null;
  income_transaction?: {
    id: string;
    amount: number;
    transaction_date: string;
    customer_name: string | null;
    status: string;
  } | null;
  expense?: {
    id: string;
    expense_name: string;
    amount: number;
    purchase_request_id: string | null;
    purchase_request?: {
      request_title: string | null;
      paid_at: string | null;
    } | null;
  } | null;
};

export type BankStatementLineWithMatch = BankStatementLine & {
  matches?: BankMutationMatch[];
};
