-- Omnichannel livechat conversion: one bank account per org receives conversion income routing.
ALTER TABLE public.bank_accounts
  ADD COLUMN IF NOT EXISTS use_for_omnichannel_income boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS idx_bank_accounts_one_omnichannel_per_org
  ON public.bank_accounts (organization_id)
  WHERE use_for_omnichannel_income = true;
