-- Xendit sub-account: optional email until form submit + linked payout bank.

ALTER TABLE public.organization_xendit_accounts
  ALTER COLUMN email DROP NOT NULL;

ALTER TABLE public.organization_xendit_accounts
  ADD COLUMN IF NOT EXISTS linked_bank_account_id uuid NULL
    REFERENCES public.bank_accounts (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payout_bank_code text NULL,
  ADD COLUMN IF NOT EXISTS payout_account_number text NULL,
  ADD COLUMN IF NOT EXISTS payout_account_holder_name text NULL;

CREATE INDEX IF NOT EXISTS idx_organization_xendit_linked_bank
  ON public.organization_xendit_accounts (linked_bank_account_id)
  WHERE linked_bank_account_id IS NOT NULL;
