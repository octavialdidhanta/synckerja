-- Outgoing bank mutations: link Payment Process expenses to bank_statement_lines,
-- debit matching, and Brick reconciliation.

-- ---------------------------------------------------------------------------
-- Schema: bank_statement_lines.origin + expense_id
-- ---------------------------------------------------------------------------
ALTER TABLE public.bank_statement_lines
  ADD COLUMN IF NOT EXISTS origin text NOT NULL DEFAULT 'brick_sync';

ALTER TABLE public.bank_statement_lines
  ADD COLUMN IF NOT EXISTS expense_id uuid NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bank_statement_lines_origin_check'
  ) THEN
    ALTER TABLE public.bank_statement_lines
      ADD CONSTRAINT bank_statement_lines_origin_check CHECK (
        origin = ANY (
          ARRAY[
            'brick_sync'::text,
            'brick_va'::text,
            'brick_disbursement'::text,
            'erp_expense'::text
          ]
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bank_statement_lines_expense_id_fkey'
  ) THEN
    ALTER TABLE public.bank_statement_lines
      ADD CONSTRAINT bank_statement_lines_expense_id_fkey
      FOREIGN KEY (expense_id) REFERENCES public.expenses (id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_bank_statement_lines_expense_id
  ON public.bank_statement_lines (expense_id)
  WHERE expense_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bank_statement_lines_org_origin
  ON public.bank_statement_lines (organization_id, origin);

-- ---------------------------------------------------------------------------
-- Schema: expenses.brick_bank_statement_line_id
-- ---------------------------------------------------------------------------
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS brick_bank_statement_line_id uuid NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'expenses_brick_bank_statement_line_id_fkey'
  ) THEN
    ALTER TABLE public.expenses
      ADD CONSTRAINT expenses_brick_bank_statement_line_id_fkey
      FOREIGN KEY (brick_bank_statement_line_id)
      REFERENCES public.bank_statement_lines (id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_expenses_brick_bank_statement_line
  ON public.expenses (brick_bank_statement_line_id)
  WHERE brick_bank_statement_line_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Schema: bank_mutation_matches.expense_id
-- ---------------------------------------------------------------------------
ALTER TABLE public.bank_mutation_matches
  ADD COLUMN IF NOT EXISTS expense_id uuid NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bank_mutation_matches_expense_id_fkey'
  ) THEN
    ALTER TABLE public.bank_mutation_matches
      ADD CONSTRAINT bank_mutation_matches_expense_id_fkey
      FOREIGN KEY (expense_id) REFERENCES public.expenses (id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_bank_mutation_matches_expense_id
  ON public.bank_mutation_matches (expense_id)
  WHERE expense_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Upsert debit line from Payment Process expense (ERP ledger mirror)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.upsert_bank_statement_from_erp_expense(p_expense_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expense public.expenses%ROWTYPE;
  v_bank_id uuid;
  v_external_id text;
  v_description text;
  v_line_id uuid;
  v_provider_label text;
  v_payload jsonb;
BEGIN
  SELECT * INTO v_expense FROM public.expenses WHERE id = p_expense_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF v_expense.purchase_request_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF v_expense.withdrawal_from_balance IS NOT NULL THEN
    RETURN NULL;
  END IF;

  IF v_expense.brick_bank_statement_line_id IS NOT NULL THEN
    RETURN v_expense.brick_bank_statement_line_id;
  END IF;

  v_bank_id := v_expense.bank_account_id;

  IF v_bank_id IS NULL AND v_expense.gateway_wallet_provider IS NOT NULL THEN
    v_bank_id := public.resolve_brick_disbursement_source_bank_account_id(v_expense.organization_id);
    IF v_bank_id IS NULL THEN
      SELECT ba.id INTO v_bank_id
      FROM public.bank_accounts ba
      WHERE ba.organization_id = v_expense.organization_id
        AND ba.is_active = true
      ORDER BY ba.created_at ASC
      LIMIT 1;
    END IF;
  END IF;

  IF v_bank_id IS NULL THEN
    RETURN NULL;
  END IF;

  v_external_id := 'erp-expense-' || v_expense.id::text;

  IF v_expense.gateway_wallet_provider = 'brick' THEN
    v_provider_label := 'Brick drawer';
  ELSIF v_expense.gateway_wallet_provider = 'xendit' THEN
    v_provider_label := 'Xendit drawer';
  ELSE
    v_provider_label := NULL;
  END IF;

  IF v_provider_label IS NOT NULL THEN
    v_description := 'Payment Process — ' || v_provider_label || ' — ' || v_expense.expense_name;
  ELSE
    v_description := 'Payment Process — ' || v_expense.expense_name;
  END IF;

  v_payload := jsonb_build_object(
    'source', 'erp_payment_process',
    'purchase_request_id', v_expense.purchase_request_id,
    'gateway_wallet_provider', v_expense.gateway_wallet_provider
  );

  SELECT id INTO v_line_id
  FROM public.bank_statement_lines
  WHERE organization_id = v_expense.organization_id
    AND external_id = v_external_id
  LIMIT 1;

  IF v_line_id IS NOT NULL THEN
    UPDATE public.bank_statement_lines
    SET
      amount = v_expense.amount,
      description = v_description,
      expense_id = v_expense.id,
      raw_payload = v_payload,
      synced_at = now()
    WHERE id = v_line_id;
  ELSE
    INSERT INTO public.bank_statement_lines (
      organization_id,
      bank_account_id,
      external_id,
      transaction_date,
      amount,
      direction,
      description,
      reference,
      raw_payload,
      origin,
      expense_id,
      synced_at
    ) VALUES (
      v_expense.organization_id,
      v_bank_id,
      v_external_id,
      (v_expense.create_date::timestamptz + interval '12 hours'),
      v_expense.amount,
      'debit',
      v_description,
      v_expense.purchase_request_id::text,
      v_payload,
      'erp_expense',
      v_expense.id,
      now()
    )
    RETURNING id INTO v_line_id;
  END IF;

  UPDATE public.expenses
  SET brick_bank_statement_line_id = v_line_id
  WHERE id = v_expense.id
    AND brick_bank_statement_line_id IS NULL;

  RETURN v_line_id;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_bank_statement_from_erp_expense(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_bank_statement_from_erp_expense(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.upsert_bank_statement_from_erp_expense(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- AFTER INSERT trigger on expenses (payment-process outgoing mirror)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_expense_bank_statement_outgoing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.purchase_request_id IS NOT NULL THEN
    PERFORM public.upsert_bank_statement_from_erp_expense(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_expense_bank_statement_outgoing ON public.expenses;
CREATE TRIGGER trg_expense_bank_statement_outgoing
  AFTER INSERT ON public.expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_expense_bank_statement_outgoing();

-- ---------------------------------------------------------------------------
-- Match debit bank lines to expenses / paid purchase requests
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.run_bank_expense_mutation_match_for_org(p_organization_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_confirmed integer := 0;
  v_suggested integer := 0;
  v_linked integer := 0;
BEGIN
  -- Link Brick debit lines to existing ERP expenses (dedup / reconcile)
  UPDATE public.bank_statement_lines sl
  SET expense_id = e.id
  FROM public.expenses e
  WHERE sl.organization_id = p_organization_id
    AND sl.direction = 'debit'
    AND sl.expense_id IS NULL
    AND sl.origin <> 'erp_expense'
    AND e.organization_id = sl.organization_id
    AND e.purchase_request_id IS NOT NULL
    AND e.amount = sl.amount
    AND (
      e.bank_account_id = sl.bank_account_id
      OR (
        e.gateway_wallet_provider IS NOT NULL
        AND e.bank_account_id IS NULL
      )
    )
    AND sl.transaction_date >= (e.create_date::timestamptz - interval '1 day')
    AND sl.transaction_date <= (e.create_date::timestamptz + interval '2 days');

  GET DIAGNOSTICS v_linked = ROW_COUNT;

  -- Confirmed matches when expense already exists
  INSERT INTO public.bank_mutation_matches (
    organization_id,
    statement_line_id,
    expense_id,
    match_score,
    match_reason,
    status,
    confirmed_at
  )
  SELECT
    p_organization_id,
    sl.id,
    e.id,
    100,
    'exact_amount+account+date+expense',
    'confirmed',
    now()
  FROM public.bank_statement_lines sl
  INNER JOIN public.expenses e
    ON e.id = sl.expense_id
    AND e.organization_id = sl.organization_id
  WHERE sl.organization_id = p_organization_id
    AND sl.direction = 'debit'
    AND sl.expense_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.bank_mutation_matches m
      WHERE m.statement_line_id = sl.id
        AND m.status IN ('suggested', 'confirmed')
    );

  GET DIAGNOSTICS v_confirmed = ROW_COUNT;

  -- Suggested matches: Brick debit without expense_id → paid PR with expense
  INSERT INTO public.bank_mutation_matches (
    organization_id,
    statement_line_id,
    expense_id,
    match_score,
    match_reason,
    status
  )
  SELECT
    p_organization_id,
    sl.id,
    e.id,
    90,
    'exact_amount+account+date+suggested',
    'suggested'
  FROM public.bank_statement_lines sl
  INNER JOIN public.expenses e
    ON e.organization_id = sl.organization_id
    AND e.purchase_request_id IS NOT NULL
    AND e.amount = sl.amount
    AND (
      (e.bank_account_id IS NOT NULL AND e.bank_account_id = sl.bank_account_id)
      OR e.gateway_wallet_provider IS NOT NULL
    )
  INNER JOIN public.purchase_requests pr
    ON pr.id = e.purchase_request_id
    AND pr.payment_status = 'paid'
  WHERE sl.organization_id = p_organization_id
    AND sl.direction = 'debit'
    AND sl.expense_id IS NULL
    AND sl.origin <> 'erp_expense'
    AND sl.transaction_date >= (e.create_date::timestamptz - interval '1 day')
    AND sl.transaction_date <= (e.create_date::timestamptz + interval '2 days')
    AND NOT EXISTS (
      SELECT 1 FROM public.bank_mutation_matches m
      WHERE m.statement_line_id = sl.id
        AND m.status IN ('suggested', 'confirmed')
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.bank_mutation_matches m
      WHERE m.expense_id = e.id
        AND m.status IN ('suggested', 'confirmed')
    );

  GET DIAGNOSTICS v_suggested = ROW_COUNT;

  RETURN jsonb_build_object(
    'ok', true,
    'linked_expense_lines', v_linked,
    'confirmed_inserted', v_confirmed,
    'suggested_inserted', v_suggested
  );
END;
$$;

REVOKE ALL ON FUNCTION public.run_bank_expense_mutation_match_for_org(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.run_bank_expense_mutation_match_for_org(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.run_bank_expense_mutation_match_for_org(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- Confirm suggested debit → expense link
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.confirm_bank_expense_mutation_match(p_match_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match public.bank_mutation_matches%ROWTYPE;
  v_actor uuid;
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

  IF v_match.expense_id IS NULL THEN
    RAISE EXCEPTION 'bank_mutation_match_no_expense';
  END IF;

  UPDATE public.bank_statement_lines
  SET expense_id = v_match.expense_id
  WHERE id = v_match.statement_line_id
    AND expense_id IS NULL;

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
    'expense_id', v_match.expense_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_bank_expense_mutation_match(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_bank_expense_mutation_match(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Disbursement callback upsert: set origin + optional expense link
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.upsert_bank_statement_from_brick_disbursement_callback(
  p_organization_id uuid,
  p_bank_account_id uuid,
  p_external_id text,
  p_transaction_date timestamptz,
  p_amount numeric,
  p_description text,
  p_reference text,
  p_raw_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_line_id uuid;
  v_expense_id uuid;
BEGIN
  IF p_external_id IS NULL OR btrim(p_external_id) = '' THEN
    RAISE EXCEPTION 'brick_disbursement_statement_external_id_required';
  END IF;

  SELECT e.id INTO v_expense_id
  FROM public.brick_disbursements bd
  INNER JOIN public.expenses e ON e.purchase_request_id = bd.source_id
  WHERE bd.organization_id = p_organization_id
    AND bd.source_type = 'purchase_request'
    AND (bd.brick_disbursement_id = p_external_id OR bd.reference_id = p_reference)
  ORDER BY e.created_at DESC
  LIMIT 1;

  SELECT id INTO v_line_id
  FROM public.bank_statement_lines
  WHERE organization_id = p_organization_id
    AND external_id = p_external_id
  LIMIT 1;

  IF v_line_id IS NOT NULL THEN
    UPDATE public.bank_statement_lines
    SET
      amount = p_amount,
      description = COALESCE(p_description, description),
      reference = COALESCE(p_reference, reference),
      raw_payload = p_raw_payload,
      origin = 'brick_disbursement',
      expense_id = COALESCE(expense_id, v_expense_id),
      synced_at = now()
    WHERE id = v_line_id;
    RETURN v_line_id;
  END IF;

  INSERT INTO public.bank_statement_lines (
    organization_id,
    bank_account_id,
    external_id,
    transaction_date,
    amount,
    direction,
    description,
    reference,
    raw_payload,
    origin,
    expense_id,
    synced_at
  ) VALUES (
    p_organization_id,
    p_bank_account_id,
    p_external_id,
    p_transaction_date,
    p_amount,
    'debit',
    p_description,
    p_reference,
    p_raw_payload,
    'brick_disbursement',
    v_expense_id,
    now()
  )
  RETURNING id INTO v_line_id;

  RETURN v_line_id;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_bank_statement_from_brick_disbursement_callback(
  uuid, uuid, text, timestamptz, numeric, text, text, jsonb
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_bank_statement_from_brick_disbursement_callback(
  uuid, uuid, text, timestamptz, numeric, text, text, jsonb
) TO service_role;

COMMENT ON FUNCTION public.upsert_bank_statement_from_erp_expense(uuid) IS
  'Mirror Payment Process expense as debit bank_statement_line (bank or gateway drawer).';
COMMENT ON FUNCTION public.run_bank_expense_mutation_match_for_org(uuid) IS
  'Match debit bank_statement_lines to expenses from payment process; reconcile Brick debits.';

-- ---------------------------------------------------------------------------
-- VA callback upsert: set origin brick_va
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.upsert_bank_statement_from_brick_callback(
  p_organization_id uuid,
  p_bank_account_id uuid,
  p_external_id text,
  p_transaction_date timestamptz,
  p_amount numeric,
  p_description text,
  p_reference text,
  p_raw_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_line_id uuid;
BEGIN
  IF p_external_id IS NULL OR btrim(p_external_id) = '' THEN
    RAISE EXCEPTION 'brick_statement_external_id_required';
  END IF;

  SELECT id INTO v_line_id
  FROM public.bank_statement_lines
  WHERE organization_id = p_organization_id
    AND external_id = p_external_id
  LIMIT 1;

  IF v_line_id IS NOT NULL THEN
    UPDATE public.bank_statement_lines
    SET
      amount = p_amount,
      description = COALESCE(p_description, description),
      reference = COALESCE(p_reference, reference),
      raw_payload = p_raw_payload,
      origin = 'brick_va',
      synced_at = now()
    WHERE id = v_line_id;
    RETURN v_line_id;
  END IF;

  INSERT INTO public.bank_statement_lines (
    organization_id,
    bank_account_id,
    external_id,
    transaction_date,
    amount,
    direction,
    description,
    reference,
    raw_payload,
    origin,
    synced_at
  ) VALUES (
    p_organization_id,
    p_bank_account_id,
    p_external_id,
    p_transaction_date,
    p_amount,
    'credit',
    p_description,
    p_reference,
    p_raw_payload,
    'brick_va',
    now()
  )
  RETURNING id INTO v_line_id;

  RETURN v_line_id;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_bank_statement_from_brick_callback(
  uuid, uuid, text, timestamptz, numeric, text, text, jsonb
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_bank_statement_from_brick_callback(
  uuid, uuid, text, timestamptz, numeric, text, text, jsonb
) TO service_role;
