-- Per sub-account Xendit wallet snapshots + withdrawal history index.
-- organization_gateway_wallets (provider=xendit) remains the org-level AGGREGATE row.

CREATE TABLE IF NOT EXISTS public.xendit_sub_account_wallets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  sub_account_row_id uuid NOT NULL REFERENCES public.xendit_sub_accounts (id) ON DELETE CASCADE,
  xendit_sub_account_id text NOT NULL,
  usable_balance numeric NOT NULL DEFAULT 0,
  pending_balance numeric NOT NULL DEFAULT 0,
  total_balance numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'IDR',
  synced_at timestamptz NULL,
  sync_error text NULL,
  raw_payload jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT xendit_sub_account_wallets_row_unique UNIQUE (sub_account_row_id),
  CONSTRAINT xendit_sub_account_wallets_xendit_id_unique UNIQUE (organization_id, xendit_sub_account_id)
);

CREATE INDEX IF NOT EXISTS idx_xendit_sub_account_wallets_org
  ON public.xendit_sub_account_wallets (organization_id);

CREATE INDEX IF NOT EXISTS idx_xendit_sub_account_wallets_xendit_id
  ON public.xendit_sub_account_wallets (xendit_sub_account_id);

CREATE INDEX IF NOT EXISTS idx_xendit_gateway_withdrawals_org_sub_created
  ON public.xendit_gateway_withdrawals (organization_id, sub_account_id, created_at DESC);

ALTER TABLE public.xendit_sub_account_wallets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS xendit_sub_account_wallets_org_select ON public.xendit_sub_account_wallets;
CREATE POLICY xendit_sub_account_wallets_org_select
  ON public.xendit_sub_account_wallets FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

COMMENT ON TABLE public.xendit_sub_account_wallets IS
  'Cached CASH/HOLDING balance per xenPlatform sub-account. organization_gateway_wallets (xendit) = SUM of active rows.';
