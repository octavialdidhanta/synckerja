-- Brick bank mutation sync: statement lines, match suggestions, bank_accounts link columns.

-- ---------------------------------------------------------------------------
-- bank_accounts: Brick link metadata
-- ---------------------------------------------------------------------------
ALTER TABLE public.bank_accounts
  ADD COLUMN IF NOT EXISTS brick_account_id text NULL,
  ADD COLUMN IF NOT EXISTS brick_link_status text NOT NULL DEFAULT 'unlinked',
  ADD COLUMN IF NOT EXISTS brick_last_sync_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS brick_last_sync_error text NULL,
  ADD COLUMN IF NOT EXISTS bank_statement_balance numeric(15, 2) NULL;

ALTER TABLE public.bank_accounts
  DROP CONSTRAINT IF EXISTS bank_accounts_brick_link_status_check;

ALTER TABLE public.bank_accounts
  ADD CONSTRAINT bank_accounts_brick_link_status_check CHECK (
    brick_link_status = ANY (
      ARRAY['unlinked'::text, 'pending'::text, 'linked'::text, 'error'::text]
    )
  );

COMMENT ON COLUMN public.bank_accounts.brick_account_id IS
  'Brick reference id (activityId or account link id) for programmatic sync.';
COMMENT ON COLUMN public.bank_accounts.brick_link_status IS
  'unlinked | pending | linked | error';
COMMENT ON COLUMN public.bank_accounts.bank_statement_balance IS
  'Latest balance from Brick / bank feed (external truth for drift view).';

-- ---------------------------------------------------------------------------
-- Rate limit: max 1 sync request per org per 2 minutes
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organization_brick_sync_limits (
  organization_id uuid NOT NULL PRIMARY KEY REFERENCES public.organizations (id) ON DELETE CASCADE,
  last_sync_requested_at timestamptz NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.organization_brick_sync_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "organization_brick_sync_limits_org_select" ON public.organization_brick_sync_limits;
CREATE POLICY "organization_brick_sync_limits_org_select"
  ON public.organization_brick_sync_limits FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

-- ---------------------------------------------------------------------------
-- bank_statement_lines
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bank_statement_lines (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  bank_account_id uuid NOT NULL REFERENCES public.bank_accounts (id) ON DELETE CASCADE,
  external_id text NOT NULL,
  transaction_date timestamptz NOT NULL,
  amount numeric(15, 2) NOT NULL,
  direction text NOT NULL,
  description text NULL,
  reference text NULL,
  counterparty_name text NULL,
  raw_payload jsonb NULL,
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bank_statement_lines_direction_check CHECK (
    direction = ANY (ARRAY['credit'::text, 'debit'::text])
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bank_statement_lines_org_external
  ON public.bank_statement_lines (organization_id, external_id);

CREATE INDEX IF NOT EXISTS idx_bank_statement_lines_org_account_date
  ON public.bank_statement_lines (organization_id, bank_account_id, transaction_date DESC);

ALTER TABLE public.bank_statement_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bank_statement_lines_org_select" ON public.bank_statement_lines;
CREATE POLICY "bank_statement_lines_org_select"
  ON public.bank_statement_lines FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

-- ---------------------------------------------------------------------------
-- bank_mutation_matches
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bank_mutation_matches (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  statement_line_id uuid NOT NULL REFERENCES public.bank_statement_lines (id) ON DELETE CASCADE,
  income_transaction_id uuid NULL REFERENCES public.income_transactions (id) ON DELETE SET NULL,
  sales_activity_payment_id uuid NULL REFERENCES public.sales_activity_payments (id) ON DELETE SET NULL,
  match_score smallint NOT NULL DEFAULT 0,
  match_reason text NULL,
  status text NOT NULL DEFAULT 'suggested',
  confirmed_by uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  confirmed_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bank_mutation_matches_status_check CHECK (
    status = ANY (
      ARRAY['suggested'::text, 'confirmed'::text, 'rejected'::text, 'expired'::text]
    )
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bank_mutation_matches_line_confirmed
  ON public.bank_mutation_matches (statement_line_id)
  WHERE status = 'confirmed';

CREATE INDEX IF NOT EXISTS idx_bank_mutation_matches_org_status
  ON public.bank_mutation_matches (organization_id, status);

CREATE INDEX IF NOT EXISTS idx_bank_mutation_matches_payment
  ON public.bank_mutation_matches (sales_activity_payment_id)
  WHERE sales_activity_payment_id IS NOT NULL;

ALTER TABLE public.bank_mutation_matches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bank_mutation_matches_org_select" ON public.bank_mutation_matches;
CREATE POLICY "bank_mutation_matches_org_select"
  ON public.bank_mutation_matches FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

-- ---------------------------------------------------------------------------
-- deposit_source: add brick_mutasi
-- ---------------------------------------------------------------------------
ALTER TABLE public.income_transactions
  DROP CONSTRAINT IF EXISTS income_transactions_deposit_source_check;

ALTER TABLE public.income_transactions
  ADD CONSTRAINT income_transactions_deposit_source_check CHECK (
    deposit_source IS NULL
    OR deposit_source = ANY (
      ARRAY[
        'manual_verification'::text,
        'xendit_va'::text,
        'manual_admin'::text,
        'brick_mutasi'::text
      ]
    )
  );

COMMENT ON COLUMN public.income_transactions.deposit_source IS
  'manual_verification | xendit_va | manual_admin | brick_mutasi';

-- ---------------------------------------------------------------------------
-- Matching engine
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.run_bank_mutation_match_for_org(p_organization_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted integer := 0;
BEGIN
  IF NOT public.user_is_org_owner_or_admin(p_organization_id) THEN
    RAISE EXCEPTION 'bank_mutation_match_forbidden';
  END IF;

  INSERT INTO public.bank_mutation_matches (
    organization_id,
    statement_line_id,
    income_transaction_id,
    sales_activity_payment_id,
    match_score,
    match_reason,
    status
  )
  SELECT
    p_organization_id,
    sl.id,
    it.id,
    it.sales_activity_payment_id,
    100,
    'exact_amount+account+date',
    'suggested'
  FROM public.bank_statement_lines sl
  INNER JOIN public.income_transactions it
    ON it.organization_id = sl.organization_id
    AND it.bank_account_id = sl.bank_account_id
    AND it.status = 'pending'
    AND it.deposit_confirmed_at IS NULL
    AND it.amount = sl.amount
  INNER JOIN public.sales_activity_payments sap
    ON sap.id = it.sales_activity_payment_id
    AND sap.transfer_verification_status = 'unchecked'
  WHERE sl.organization_id = p_organization_id
    AND sl.direction = 'credit'
    AND NOT EXISTS (
      SELECT 1 FROM public.bank_mutation_matches m
      WHERE m.statement_line_id = sl.id AND m.status = 'confirmed'
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.bank_mutation_matches m
      WHERE m.income_transaction_id = it.id AND m.status IN ('suggested', 'confirmed')
    )
    AND sl.transaction_date >= (
      COALESCE(sap.payment_date::timestamptz, it.transaction_date::timestamptz) - interval '1 day'
    )
    AND sl.transaction_date <= (
      COALESCE(sap.payment_date::timestamptz, it.transaction_date::timestamptz) + interval '1 day'
    );

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  RETURN jsonb_build_object('ok', true, 'suggested_inserted', v_inserted);
END;
$$;

REVOKE ALL ON FUNCTION public.run_bank_mutation_match_for_org(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.run_bank_mutation_match_for_org(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Confirm suggested match → deposit + piutang OK
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.confirm_bank_mutation_match(p_match_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match public.bank_mutation_matches%ROWTYPE;
  v_actor uuid;
  v_confirm jsonb;
BEGIN
  v_actor := auth.uid();

  SELECT * INTO v_match
  FROM public.bank_mutation_matches
  WHERE id = p_match_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'bank_mutation_match_not_found';
  END IF;

  IF NOT public.user_is_org_owner_or_admin(v_match.organization_id) THEN
    RAISE EXCEPTION 'bank_mutation_match_forbidden';
  END IF;

  IF v_match.status <> 'suggested' THEN
    RAISE EXCEPTION 'bank_mutation_match_not_suggested';
  END IF;

  IF v_match.income_transaction_id IS NULL THEN
    RAISE EXCEPTION 'bank_mutation_match_no_income';
  END IF;

  v_confirm := public.confirm_income_bank_deposit(
    v_match.income_transaction_id,
    'brick_mutasi',
    v_actor
  );

  IF v_match.sales_activity_payment_id IS NOT NULL THEN
    UPDATE public.sales_activity_payments
    SET
      transfer_verification_status = 'approved',
      transfer_verified_at = now(),
      transfer_verified_by = v_actor
    WHERE id = v_match.sales_activity_payment_id;
  END IF;

  UPDATE public.bank_mutation_matches
  SET
    status = 'confirmed',
    confirmed_by = v_actor,
    confirmed_at = now(),
    updated_at = now()
  WHERE id = v_match.id;

  RETURN jsonb_build_object(
    'ok', true,
    'match_id', v_match.id,
    'deposit', v_confirm
  );
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_bank_mutation_match(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_bank_mutation_match(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Reject suggested match
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reject_bank_mutation_match(p_match_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match public.bank_mutation_matches%ROWTYPE;
BEGIN
  SELECT * INTO v_match
  FROM public.bank_mutation_matches
  WHERE id = p_match_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'bank_mutation_match_not_found';
  END IF;

  IF NOT public.user_is_org_owner_or_admin(v_match.organization_id) THEN
    RAISE EXCEPTION 'bank_mutation_match_forbidden';
  END IF;

  IF v_match.status <> 'suggested' THEN
    RAISE EXCEPTION 'bank_mutation_match_not_suggested';
  END IF;

  UPDATE public.bank_mutation_matches
  SET status = 'rejected', updated_at = now()
  WHERE id = v_match.id;

  RETURN jsonb_build_object('ok', true, 'match_id', v_match.id);
END;
$$;

REVOKE ALL ON FUNCTION public.reject_bank_mutation_match(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reject_bank_mutation_match(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Unlink Brick from bank account
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.unlink_bank_account_brick(p_bank_account_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
BEGIN
  SELECT organization_id INTO v_org
  FROM public.bank_accounts
  WHERE id = p_bank_account_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'bank_account_not_found';
  END IF;

  IF NOT public.user_is_org_owner_or_admin(v_org) THEN
    RAISE EXCEPTION 'bank_brick_unlink_forbidden';
  END IF;

  UPDATE public.bank_accounts
  SET
    brick_account_id = NULL,
    brick_link_status = 'unlinked',
    brick_last_sync_error = NULL,
    bank_statement_balance = NULL,
    updated_at = now()
  WHERE id = p_bank_account_id;

  RETURN jsonb_build_object('ok', true, 'bank_account_id', p_bank_account_id);
END;
$$;

REVOKE ALL ON FUNCTION public.unlink_bank_account_brick(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unlink_bank_account_brick(uuid) TO authenticated;
