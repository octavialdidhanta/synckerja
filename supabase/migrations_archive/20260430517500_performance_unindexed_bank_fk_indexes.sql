-- Performance Advisor (INFO): unindexed foreign keys
-- Fix missing FK-column indexes for bank ledger tables.
-- These cover foreign keys declared on:
-- - public.bank_accounts.created_by -> auth.users(id)
-- - public.bank_transfer_journals.from_bank_account_id -> public.bank_accounts(id)
-- - public.bank_transfer_journals.to_bank_account_id -> public.bank_accounts(id)
-- - public.bank_transfer_journals.expense_id -> public.expenses(id)
-- - public.bank_transfer_journals.created_by -> auth.users(id)
-- - public.bank_account_balance_history.created_by -> auth.users(id)

-- bank_accounts
CREATE INDEX IF NOT EXISTS idx_bank_accounts_created_by
  ON public.bank_accounts (created_by);

-- bank_transfer_journals
CREATE INDEX IF NOT EXISTS idx_bank_transfer_journals_from_bank_account_id
  ON public.bank_transfer_journals (from_bank_account_id);

CREATE INDEX IF NOT EXISTS idx_bank_transfer_journals_to_bank_account_id
  ON public.bank_transfer_journals (to_bank_account_id);

CREATE INDEX IF NOT EXISTS idx_bank_transfer_journals_expense_id
  ON public.bank_transfer_journals (expense_id);

CREATE INDEX IF NOT EXISTS idx_bank_transfer_journals_created_by
  ON public.bank_transfer_journals (created_by);

-- bank_account_balance_history
CREATE INDEX IF NOT EXISTS idx_bank_account_balance_history_created_by
  ON public.bank_account_balance_history (created_by);

