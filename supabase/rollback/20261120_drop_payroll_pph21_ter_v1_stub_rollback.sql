-- Rollback for 20261120061435_drop_payroll_pph21_ter_v1_stub.sql: recreate the stub
-- exactly as it was in production on 2026-11-20 (definition, grants, comment).
BEGIN;

CREATE OR REPLACE FUNCTION public.payroll_calculate_pph21_ter(p_monthly_gross numeric, p_ptkp_status text DEFAULT 'TK/0'::text, p_effective_year integer DEFAULT 2024)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_rate numeric := 0;
  v_tax numeric;
BEGIN
  SELECT monthly_ter_rate
  INTO v_rate
  FROM public.payroll_ter_categories
  WHERE ptkp_status = COALESCE(p_ptkp_status, 'TK/0')
    AND effective_year = p_effective_year
  ORDER BY category_code
  LIMIT 1;

  v_rate := COALESCE(v_rate, 0);
  v_tax := round(GREATEST(COALESCE(p_monthly_gross, 0), 0) * v_rate);

  RETURN jsonb_build_object(
    'taxMethod', 'ter',
    'monthlyTax', v_tax,
    'terRate', v_rate,
    'takeHomePay', round(GREATEST(COALESCE(p_monthly_gross, 0), 0) - v_tax)
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.payroll_calculate_pph21_ter(numeric, text, integer) TO anon, authenticated, service_role;
COMMENT ON FUNCTION public.payroll_calculate_pph21_ter(numeric, text, integer) IS 'Phase 2 TER stub. Wire into payroll_calculate_employee when calculation_mode = ter.';

COMMIT;
