-- Allow brick-bank-api (service role) to run matching after edge already verified owner/admin.

CREATE OR REPLACE FUNCTION public.run_bank_mutation_match_for_org(p_organization_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted integer := 0;
  v_role text := COALESCE(auth.jwt() ->> 'role', '');
BEGIN
  IF v_role IS DISTINCT FROM 'service_role'
     AND NOT public.user_is_org_owner_or_admin(p_organization_id) THEN
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
GRANT EXECUTE ON FUNCTION public.run_bank_mutation_match_for_org(uuid) TO service_role;
