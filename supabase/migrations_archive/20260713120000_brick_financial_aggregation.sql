-- Brick Financial Aggregation (OAuth Widget) + credit card debt statement lines

-- ---------------------------------------------------------------------------
-- OAuth state (widget redirect)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.brick_oauth_states (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  state_token text NOT NULL,
  target_type text NOT NULL,
  target_id uuid NOT NULL,
  return_path text NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT brick_oauth_states_state_token_key UNIQUE (state_token),
  CONSTRAINT brick_oauth_states_target_type_check CHECK (
    target_type = ANY (ARRAY['bank_account'::text, 'debt'::text])
  )
);

CREATE INDEX IF NOT EXISTS idx_brick_oauth_states_expires
  ON public.brick_oauth_states (expires_at);

ALTER TABLE public.brick_oauth_states ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Encrypted user tokens from Brick Widget
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.brick_financial_connections (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  brick_user_id text NULL,
  access_token_enc text NOT NULL,
  refresh_token_enc text NULL,
  access_token_expires_at timestamptz NULL,
  institution_id text NULL,
  institution_name text NULL,
  status text NOT NULL DEFAULT 'pending',
  linked_at timestamptz NULL,
  last_sync_at timestamptz NULL,
  last_sync_error text NULL,
  raw_payload jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT brick_financial_connections_status_check CHECK (
    status = ANY (
      ARRAY['pending'::text, 'active'::text, 'expired'::text, 'revoked'::text]
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_brick_financial_connections_org_status
  ON public.brick_financial_connections (organization_id, status);

ALTER TABLE public.brick_financial_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "brick_financial_connections_org_select" ON public.brick_financial_connections;
CREATE POLICY "brick_financial_connections_org_select"
  ON public.brick_financial_connections FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

COMMENT ON TABLE public.brick_financial_connections IS
  'Brick Account Aggregation OAuth tokens per org. Edge Functions read/write encrypted tokens.';

-- ---------------------------------------------------------------------------
-- Org default expense mapping for Brick CC auto-import
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organization_brick_import_settings (
  organization_id uuid NOT NULL PRIMARY KEY REFERENCES public.organizations (id) ON DELETE CASCADE,
  default_expense_category_id uuid NULL REFERENCES public.expense_categories (id) ON DELETE SET NULL,
  default_expense_type_id uuid NULL REFERENCES public.expense_types (id) ON DELETE SET NULL,
  import_created_by uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.organization_brick_import_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "organization_brick_import_settings_org_select" ON public.organization_brick_import_settings;
CREATE POLICY "organization_brick_import_settings_org_select"
  ON public.organization_brick_import_settings FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "organization_brick_import_settings_org_write" ON public.organization_brick_import_settings;
CREATE POLICY "organization_brick_import_settings_org_write"
  ON public.organization_brick_import_settings FOR ALL TO authenticated
  USING (public.user_is_org_owner_or_admin(organization_id))
  WITH CHECK (public.user_is_org_owner_or_admin(organization_id));

-- ---------------------------------------------------------------------------
-- bank_accounts: aggregation OAuth fields
-- ---------------------------------------------------------------------------
ALTER TABLE public.bank_accounts
  ADD COLUMN IF NOT EXISTS brick_connection_id uuid NULL REFERENCES public.brick_financial_connections (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS brick_aggregated_account_id text NULL,
  ADD COLUMN IF NOT EXISTS brick_link_mode text NOT NULL DEFAULT 'aggregation_oauth';

ALTER TABLE public.bank_accounts
  DROP CONSTRAINT IF EXISTS bank_accounts_brick_link_mode_check;

ALTER TABLE public.bank_accounts
  ADD CONSTRAINT bank_accounts_brick_link_mode_check CHECK (
    brick_link_mode = ANY (ARRAY['aggregation_oauth'::text])
  );

COMMENT ON COLUMN public.bank_accounts.brick_connection_id IS
  'Brick Account Aggregation OAuth connection for this bank account.';
COMMENT ON COLUMN public.bank_accounts.brick_aggregated_account_id IS
  'Account id from Brick Aggregation API list accounts response.';

-- ---------------------------------------------------------------------------
-- debts: Brick fields for Kartu Kredit
-- ---------------------------------------------------------------------------
ALTER TABLE public.debts
  ADD COLUMN IF NOT EXISTS brick_connection_id uuid NULL REFERENCES public.brick_financial_connections (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS brick_aggregated_account_id text NULL,
  ADD COLUMN IF NOT EXISTS brick_link_status text NOT NULL DEFAULT 'unlinked',
  ADD COLUMN IF NOT EXISTS brick_last_sync_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS brick_last_sync_error text NULL,
  ADD COLUMN IF NOT EXISTS brick_auto_import boolean NOT NULL DEFAULT true;

ALTER TABLE public.debts
  DROP CONSTRAINT IF EXISTS debts_brick_link_status_check;

ALTER TABLE public.debts
  ADD CONSTRAINT debts_brick_link_status_check CHECK (
    brick_link_status = ANY (
      ARRAY['unlinked'::text, 'pending'::text, 'linked'::text, 'error'::text]
    )
  );

-- ---------------------------------------------------------------------------
-- debt_statement_lines (credit card mutations)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.debt_statement_lines (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  debt_id uuid NOT NULL REFERENCES public.debts (id) ON DELETE CASCADE,
  external_id text NOT NULL,
  transaction_date timestamptz NOT NULL,
  amount numeric(15, 2) NOT NULL,
  direction text NOT NULL,
  description text NULL,
  merchant_name text NULL,
  reference text NULL,
  import_status text NOT NULL DEFAULT 'pending',
  import_error text NULL,
  raw_payload jsonb NULL,
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT debt_statement_lines_direction_check CHECK (
    direction = ANY (ARRAY['credit'::text, 'debit'::text])
  ),
  CONSTRAINT debt_statement_lines_import_status_check CHECK (
    import_status = ANY (
      ARRAY[
        'pending'::text,
        'imported'::text,
        'skipped'::text,
        'failed_insufficient_limit'::text,
        'failed_missing_settings'::text,
        'failed'::text
      ]
    )
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_debt_statement_lines_org_external
  ON public.debt_statement_lines (organization_id, external_id);

CREATE INDEX IF NOT EXISTS idx_debt_statement_lines_org_debt_date
  ON public.debt_statement_lines (organization_id, debt_id, transaction_date DESC);

ALTER TABLE public.debt_statement_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "debt_statement_lines_org_select" ON public.debt_statement_lines;
CREATE POLICY "debt_statement_lines_org_select"
  ON public.debt_statement_lines FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

-- ---------------------------------------------------------------------------
-- expenses: link to Brick debt statement line
-- ---------------------------------------------------------------------------
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS brick_debt_statement_line_id uuid NULL
    REFERENCES public.debt_statement_lines (id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_expenses_brick_debt_statement_line
  ON public.expenses (brick_debt_statement_line_id)
  WHERE brick_debt_statement_line_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- bank_mutation_matches: optional debt payment matching (v2.1 prep)
-- ---------------------------------------------------------------------------
ALTER TABLE public.bank_mutation_matches
  ADD COLUMN IF NOT EXISTS debt_payment_id uuid NULL
    REFERENCES public.debt_payments (id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- Reset v1 GS validation links (require OAuth re-link)
-- ---------------------------------------------------------------------------
UPDATE public.bank_accounts
SET
  brick_link_status = 'unlinked',
  brick_account_id = NULL,
  brick_last_sync_error = 'Perlu hubung ulang via Brick Widget (OAuth)',
  brick_connection_id = NULL,
  brick_aggregated_account_id = NULL,
  brick_link_mode = 'aggregation_oauth',
  updated_at = now()
WHERE brick_link_status = 'linked'
  AND brick_connection_id IS NULL;

-- ---------------------------------------------------------------------------
-- RPC: auto-create expense from Brick credit card debit line
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_expense_from_brick_debt_line(p_line_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_line public.debt_statement_lines%ROWTYPE;
  v_debt public.debts%ROWTYPE;
  v_settings public.organization_brick_import_settings%ROWTYPE;
  v_category_name text;
  v_type_name text;
  v_expense_id uuid;
  v_created_by uuid;
BEGIN
  SELECT * INTO v_line FROM public.debt_statement_lines WHERE id = p_line_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'brick_debt_line_not_found';
  END IF;

  IF auth.role() <> 'service_role'
    AND NOT public.user_is_org_owner_or_admin(v_line.organization_id) THEN
    RAISE EXCEPTION 'brick_debt_line_forbidden';
  END IF;

  IF v_line.direction <> 'debit' THEN
    UPDATE public.debt_statement_lines
    SET import_status = 'skipped', import_error = 'not_a_debit', synced_at = now()
    WHERE id = p_line_id;
    RETURN jsonb_build_object('ok', true, 'skipped', true, 'reason', 'not_a_debit');
  END IF;

  IF v_line.import_status = 'imported' THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true, 'reason', 'already_imported');
  END IF;

  SELECT * INTO v_debt FROM public.debts WHERE id = v_line.debt_id;
  IF NOT FOUND OR v_debt.debt_type <> 'Kartu Kredit' THEN
    RAISE EXCEPTION 'brick_debt_line_invalid_debt';
  END IF;

  IF COALESCE(v_debt.brick_auto_import, true) = false THEN
    UPDATE public.debt_statement_lines
    SET import_status = 'skipped', import_error = 'auto_import_disabled', synced_at = now()
    WHERE id = p_line_id;
    RETURN jsonb_build_object('ok', true, 'skipped', true, 'reason', 'auto_import_disabled');
  END IF;

  IF v_debt.status <> 'active' THEN
    UPDATE public.debt_statement_lines
    SET import_status = 'skipped', import_error = 'debt_not_active', synced_at = now()
    WHERE id = p_line_id;
    RETURN jsonb_build_object('ok', true, 'skipped', true, 'reason', 'debt_not_active');
  END IF;

  IF COALESCE(v_debt.available_limit, 0) < v_line.amount THEN
    UPDATE public.debt_statement_lines
    SET
      import_status = 'failed_insufficient_limit',
      import_error = 'available_limit_exceeded',
      synced_at = now()
    WHERE id = p_line_id;
    RETURN jsonb_build_object('ok', false, 'error', 'failed_insufficient_limit');
  END IF;

  SELECT * INTO v_settings
  FROM public.organization_brick_import_settings
  WHERE organization_id = v_line.organization_id;

  IF v_settings.default_expense_category_id IS NULL OR v_settings.default_expense_type_id IS NULL THEN
    UPDATE public.debt_statement_lines
    SET
      import_status = 'failed_missing_settings',
      import_error = 'missing_default_category_or_type',
      synced_at = now()
    WHERE id = p_line_id;
    RETURN jsonb_build_object('ok', false, 'error', 'failed_missing_settings');
  END IF;

  SELECT name INTO v_category_name
  FROM public.expense_categories
  WHERE id = v_settings.default_expense_category_id;

  SELECT name INTO v_type_name
  FROM public.expense_types
  WHERE id = v_settings.default_expense_type_id;

  IF v_category_name IS NULL OR v_type_name IS NULL THEN
    UPDATE public.debt_statement_lines
    SET
      import_status = 'failed_missing_settings',
      import_error = 'invalid_default_category_or_type',
      synced_at = now()
    WHERE id = p_line_id;
    RETURN jsonb_build_object('ok', false, 'error', 'failed_missing_settings');
  END IF;

  v_created_by := COALESCE(v_settings.import_created_by, v_debt.created_by);

  INSERT INTO public.expenses (
    organization_id,
    expense_name,
    amount,
    expense_type,
    category,
    create_date,
    description,
    status,
    created_by,
    expense_type_id,
    expense_category_id,
    withdrawal_from_balance,
    brick_debt_statement_line_id,
    exclude_from_reminder_bills,
    transaction_reference
  )
  VALUES (
    v_line.organization_id,
    COALESCE(NULLIF(trim(v_line.merchant_name), ''), NULLIF(trim(v_line.description), ''), 'Brick CC'),
    v_line.amount,
    v_type_name,
    v_category_name,
    (v_line.transaction_date AT TIME ZONE 'Asia/Jakarta')::date,
    COALESCE(v_line.description, v_line.merchant_name),
    'active',
    v_created_by,
    v_settings.default_expense_type_id,
    v_settings.default_expense_category_id,
    v_debt.id,
    p_line_id,
    true,
    v_line.external_id
  )
  RETURNING id INTO v_expense_id;

  UPDATE public.debt_statement_lines
  SET import_status = 'imported', import_error = NULL, synced_at = now()
  WHERE id = p_line_id;

  RETURN jsonb_build_object('ok', true, 'expense_id', v_expense_id);
EXCEPTION
  WHEN unique_violation THEN
    UPDATE public.debt_statement_lines
    SET import_status = 'imported', import_error = NULL, synced_at = now()
    WHERE id = p_line_id;
    RETURN jsonb_build_object('ok', true, 'skipped', true, 'reason', 'duplicate_expense');
END;
$$;

REVOKE ALL ON FUNCTION public.create_expense_from_brick_debt_line(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_expense_from_brick_debt_line(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_expense_from_brick_debt_line(uuid) TO service_role;
