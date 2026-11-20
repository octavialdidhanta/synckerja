-- Sales package price follows whole months of access, not a calendar-day fraction.
-- Billing mode stays in storage only so the existing price check still passes.
-- Live subscription rows are not rewritten.

CREATE OR REPLACE FUNCTION public.sales_contract_term_months(
  p_start date,
  p_end date
)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN p_start IS NULL OR p_end IS NULL OR p_end < p_start THEN 0
    ELSE (
      (EXTRACT(YEAR FROM p_end)::integer - EXTRACT(YEAR FROM p_start)::integer) * 12
      + (EXTRACT(MONTH FROM p_end)::integer - EXTRACT(MONTH FROM p_start)::integer)
      + CASE
          WHEN EXTRACT(DAY FROM p_end)::integer > EXTRACT(DAY FROM p_start)::integer THEN 1
          ELSE 0
        END
    )
  END;
$function$;

COMMENT ON FUNCTION public.sales_contract_term_months(date, date) IS
  'Whole months from the start date through the end date. A later day in the final month counts as one more month.';

REVOKE ALL ON FUNCTION public.sales_contract_term_months(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sales_contract_term_months(date, date) TO service_role;

CREATE OR REPLACE FUNCTION public.sales_contract_price_quote(
  p_old_monthly bigint,
  p_new_monthly bigint,
  p_old_end date,
  p_new_end date,
  p_effective date,
  p_billing_mode text
)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $function$
DECLARE
  v_months integer;
  v_amount bigint;
BEGIN
  IF p_new_monthly IS NULL OR p_new_monthly < 0 THEN
    RAISE EXCEPTION 'package price required' USING ERRCODE = '22023';
  END IF;

  IF p_effective IS NULL OR p_new_end IS NULL OR p_effective > p_new_end THEN
    RAISE EXCEPTION 'price effective date is outside the contract' USING ERRCODE = '22023';
  END IF;

  v_months := public.sales_contract_term_months(p_effective, p_new_end);
  IF v_months < 1 THEN
    RAISE EXCEPTION 'contract term must be at least 1 month' USING ERRCODE = '22023';
  END IF;

  v_amount := p_new_monthly * v_months;

  RETURN jsonb_build_object(
    'period_value_idr', v_amount,
    'adjustment_idr', v_amount,
    'term_months', v_months,
    'billing_mode', 'prepaid'
  );
END;
$function$;

COMMENT ON FUNCTION public.sales_contract_price_quote(bigint, bigint, date, date, date, text) IS
  'Package invoice is the monthly price times the whole months of access. Day fractions are not billed.';

CREATE OR REPLACE FUNCTION public.sales_contract_prepare_price(
  p_is_trial boolean,
  p_monthly_price_idr bigint,
  p_billing_mode text,
  p_ppn_included boolean,
  p_price_effective_on date,
  p_subscription_end_date timestamptz,
  p_old_monthly bigint,
  p_old_end date
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $function$
DECLARE
  v_today date := (timezone('Asia/Jakarta', now()))::date;
  v_end date;
  v_quote jsonb;
BEGIN
  IF coalesce(p_is_trial, false) THEN
    IF p_monthly_price_idr IS NOT NULL
       OR p_billing_mode IS NOT NULL
       OR p_ppn_included IS NOT NULL
       OR p_price_effective_on IS NOT NULL THEN
      RAISE EXCEPTION 'trial contract has no package price' USING ERRCODE = '22023';
    END IF;

    RETURN jsonb_build_object(
      'monthly_price_idr', NULL,
      'billing_mode', NULL,
      'ppn_included', NULL,
      'price_effective_on', NULL,
      'period_value_idr', NULL,
      'adjustment_idr', NULL,
      'term_months', NULL
    );
  END IF;

  IF p_monthly_price_idr IS NULL OR p_monthly_price_idr < 0 THEN
    RAISE EXCEPTION 'package price required' USING ERRCODE = '22023';
  END IF;

  IF p_ppn_included IS NULL THEN
    RAISE EXCEPTION 'ppn treatment required' USING ERRCODE = '22023';
  END IF;

  IF p_subscription_end_date IS NULL THEN
    RAISE EXCEPTION 'subscription_end_date required when in paid mode' USING ERRCODE = '22023';
  END IF;

  v_end := (p_subscription_end_date AT TIME ZONE 'Asia/Jakarta')::date;
  IF p_price_effective_on IS NULL OR p_price_effective_on < v_today THEN
    RAISE EXCEPTION 'price effective date cannot be in the past' USING ERRCODE = '22023';
  END IF;

  IF p_price_effective_on > v_end THEN
    RAISE EXCEPTION 'price effective date is outside the contract' USING ERRCODE = '22023';
  END IF;

  v_quote := public.sales_contract_price_quote(
    p_old_monthly,
    p_monthly_price_idr,
    p_old_end,
    v_end,
    p_price_effective_on,
    NULL
  );

  RETURN v_quote || jsonb_build_object(
    'monthly_price_idr', p_monthly_price_idr,
    'billing_mode', 'prepaid',
    'ppn_included', p_ppn_included,
    'price_effective_on', p_price_effective_on
  );
END;
$function$;
