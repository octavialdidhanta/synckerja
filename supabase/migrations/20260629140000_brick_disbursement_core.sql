-- Brick Disbursement v1: brick_disbursements, debit mutasi RPC, rate limit, debt link.

-- ---------------------------------------------------------------------------
-- brick_disbursements
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.brick_disbursements (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  source_type text NOT NULL,
  source_id uuid NOT NULL,
  reference_id text NOT NULL,
  brick_disbursement_id text NULL,
  bank_short_code text NOT NULL,
  account_holder_name text NOT NULL,
  account_no text NOT NULL,
  amount numeric NOT NULL,
  fee_amount numeric NULL,
  description text NULL,
  status text NOT NULL DEFAULT 'pending',
  source_bank_account_id uuid NULL REFERENCES public.bank_accounts (id) ON DELETE SET NULL,
  failure_code text NULL,
  failure_message text NULL,
  raw_response jsonb NULL,
  initiated_by uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT brick_disbursements_source_type_check CHECK (
    source_type = ANY (
      ARRAY['payroll_calculation', 'purchase_request', 'debt_payment', 'payroll_run_batch']::text[]
    )
  ),
  CONSTRAINT brick_disbursements_status_check CHECK (
    status = ANY (ARRAY['pending', 'processing', 'completed', 'failed']::text[])
  ),
  CONSTRAINT brick_disbursements_amount_positive CHECK (amount > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_brick_disbursements_reference_id
  ON public.brick_disbursements (reference_id);
CREATE INDEX IF NOT EXISTS idx_brick_disbursements_org
  ON public.brick_disbursements (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_brick_disbursements_source
  ON public.brick_disbursements (source_type, source_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_brick_disbursements_active_source
  ON public.brick_disbursements (source_type, source_id)
  WHERE status IN ('pending', 'processing', 'completed');

ALTER TABLE public.brick_disbursements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS brick_disbursements_org_select ON public.brick_disbursements;
CREATE POLICY brick_disbursements_org_select
  ON public.brick_disbursements FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

-- ---------------------------------------------------------------------------
-- debt_payments.brick_disbursement_id
-- ---------------------------------------------------------------------------
ALTER TABLE public.debt_payments
  ADD COLUMN IF NOT EXISTS brick_disbursement_id uuid NULL
  REFERENCES public.brick_disbursements (id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- Disburse rate limit (1 org / 60s)
-- ---------------------------------------------------------------------------
ALTER TABLE public.organization_brick_sync_limits
  ADD COLUMN IF NOT EXISTS last_disburse_requested_at timestamptz NULL;

-- ---------------------------------------------------------------------------
-- Resolve source bank account (omnichannel linked first)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_brick_disbursement_source_bank_account_id(p_organization_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bank_id uuid;
BEGIN
  SELECT ba.id INTO v_bank_id
  FROM public.bank_accounts ba
  WHERE ba.organization_id = p_organization_id
    AND ba.is_active = true
    AND ba.brick_link_status = 'linked'
    AND ba.use_for_omnichannel_income = true
  ORDER BY ba.created_at ASC
  LIMIT 1;

  IF v_bank_id IS NOT NULL THEN
    RETURN v_bank_id;
  END IF;

  SELECT ba.id INTO v_bank_id
  FROM public.bank_accounts ba
  WHERE ba.organization_id = p_organization_id
    AND ba.is_active = true
    AND ba.brick_link_status = 'linked'
  ORDER BY ba.created_at ASC
  LIMIT 1;

  RETURN v_bank_id;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_brick_disbursement_source_bank_account_id(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_brick_disbursement_source_bank_account_id(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- Upsert debit bank statement line from disbursement callback
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
BEGIN
  IF p_external_id IS NULL OR btrim(p_external_id) = '' THEN
    RAISE EXCEPTION 'brick_disbursement_statement_external_id_required';
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
