-- Xendit gateway withdrawal: sub-account CASH → registered payout bank (real disbursement API).

-- ---------------------------------------------------------------------------
-- xendit_gateway_withdrawals
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.xendit_gateway_withdrawals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  bank_account_id uuid NOT NULL REFERENCES public.bank_accounts (id) ON DELETE RESTRICT,
  sub_account_id text NOT NULL,
  amount numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  xendit_disbursement_id uuid NULL REFERENCES public.xendit_disbursements (id) ON DELETE SET NULL,
  failure_message text NULL,
  settled_at timestamptz NULL,
  initiated_by uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT xendit_gateway_withdrawals_amount_positive CHECK (amount > 0),
  CONSTRAINT xendit_gateway_withdrawals_status_check CHECK (
    status = ANY (ARRAY['pending', 'processing', 'completed', 'failed']::text[])
  )
);

CREATE INDEX IF NOT EXISTS idx_xendit_gateway_withdrawals_org_created
  ON public.xendit_gateway_withdrawals (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_xendit_gateway_withdrawals_org_processing
  ON public.xendit_gateway_withdrawals (organization_id)
  WHERE status = 'processing';

ALTER TABLE public.xendit_gateway_withdrawals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS xendit_gateway_withdrawals_org_select ON public.xendit_gateway_withdrawals;
CREATE POLICY xendit_gateway_withdrawals_org_select
  ON public.xendit_gateway_withdrawals FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

-- ---------------------------------------------------------------------------
-- Extend xendit_disbursements.source_type
-- ---------------------------------------------------------------------------
ALTER TABLE public.xendit_disbursements
  DROP CONSTRAINT IF EXISTS xendit_disbursements_source_type_check;

ALTER TABLE public.xendit_disbursements
  ADD CONSTRAINT xendit_disbursements_source_type_check CHECK (
    source_type = ANY (
      ARRAY[
        'payroll_calculation',
        'purchase_request',
        'debt_payment',
        'payroll_run_batch',
        'gateway_withdrawal'
      ]::text[]
    )
  );

-- ---------------------------------------------------------------------------
-- Extend bank_account_balance_history.transaction_type
-- ---------------------------------------------------------------------------
ALTER TABLE public.bank_account_balance_history
  DROP CONSTRAINT IF EXISTS bank_account_balance_history_transaction_type_check;

ALTER TABLE public.bank_account_balance_history
  ADD CONSTRAINT bank_account_balance_history_transaction_type_check CHECK (
    transaction_type = ANY (
      ARRAY['income', 'expense', 'manual_adjustment', 'initial', 'gateway_withdrawal']::text[]
    )
  );

-- ---------------------------------------------------------------------------
-- Settlement: credit ERP payout bank when Xendit disbursement completes
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_xendit_gateway_withdrawal_settlement(
  p_disbursement_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_disb public.xendit_disbursements%ROWTYPE;
  v_withdrawal public.xendit_gateway_withdrawals%ROWTYPE;
  v_balance_before numeric;
  v_balance_after numeric;
  v_amount numeric;
BEGIN
  SELECT * INTO v_disb
  FROM public.xendit_disbursements
  WHERE id = p_disbursement_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'xendit_disbursement_not_found';
  END IF;

  IF v_disb.source_type <> 'gateway_withdrawal' THEN
    RAISE EXCEPTION 'not_gateway_withdrawal_disbursement';
  END IF;

  IF v_disb.status <> 'completed' THEN
    RAISE EXCEPTION 'disbursement_not_completed';
  END IF;

  SELECT * INTO v_withdrawal
  FROM public.xendit_gateway_withdrawals
  WHERE id = v_disb.source_id::uuid
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'xendit_gateway_withdrawal_not_found';
  END IF;

  IF v_withdrawal.status = 'completed' AND v_withdrawal.settled_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'ok', true,
      'already_settled', true,
      'withdrawal_id', v_withdrawal.id,
      'bank_account_id', v_withdrawal.bank_account_id,
      'amount', v_withdrawal.amount
    );
  END IF;

  v_amount := v_withdrawal.amount;

  INSERT INTO public.bank_account_balances (bank_account_id, organization_id, balance)
  VALUES (v_withdrawal.bank_account_id, v_withdrawal.organization_id, 0)
  ON CONFLICT (bank_account_id) DO NOTHING;

  SELECT balance INTO v_balance_before
  FROM public.bank_account_balances
  WHERE bank_account_id = v_withdrawal.bank_account_id
  FOR UPDATE;

  v_balance_after := COALESCE(v_balance_before, 0) + v_amount;

  UPDATE public.bank_account_balances
  SET balance = v_balance_after, updated_at = now()
  WHERE bank_account_id = v_withdrawal.bank_account_id;

  INSERT INTO public.bank_account_balance_history (
    bank_account_id,
    organization_id,
    transaction_type,
    transaction_id,
    amount,
    balance_before,
    balance_after,
    description,
    created_by
  ) VALUES (
    v_withdrawal.bank_account_id,
    v_withdrawal.organization_id,
    'gateway_withdrawal',
    v_withdrawal.id,
    v_amount,
    COALESCE(v_balance_before, 0),
    v_balance_after,
    'Xendit gateway withdrawal to payout bank',
    v_withdrawal.initiated_by
  );

  UPDATE public.xendit_gateway_withdrawals
  SET
    status = 'completed',
    xendit_disbursement_id = v_disb.id,
    settled_at = now(),
    updated_at = now()
  WHERE id = v_withdrawal.id;

  RETURN jsonb_build_object(
    'ok', true,
    'withdrawal_id', v_withdrawal.id,
    'bank_account_id', v_withdrawal.bank_account_id,
    'amount', v_amount,
    'balance_after', v_balance_after
  );
END;
$$;

REVOKE ALL ON FUNCTION public.apply_xendit_gateway_withdrawal_settlement(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_xendit_gateway_withdrawal_settlement(uuid) TO service_role;
