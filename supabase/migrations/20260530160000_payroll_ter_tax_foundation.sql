-- TER (Tarif Efektif Rata-rata) — phase 2 foundation
-- Full TER calculation activates when tax_configurations.calculation_mode = 'ter'

CREATE TABLE IF NOT EXISTS public.payroll_ter_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_code text NOT NULL CHECK (category_code = ANY (ARRAY['A'::text, 'B'::text, 'C'::text])),
  ptkp_status text NOT NULL,
  effective_year integer NOT NULL DEFAULT 2024,
  monthly_ter_rate numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payroll_ter_categories_unique UNIQUE (category_code, ptkp_status, effective_year)
);

COMMENT ON TABLE public.payroll_ter_categories IS 'Reference TER rates (PP 58/2023). Populated per tax year.';

-- Placeholder rates — replace with official DJP tables per year
INSERT INTO public.payroll_ter_categories (category_code, ptkp_status, effective_year, monthly_ter_rate)
VALUES
  ('A', 'TK/0', 2024, 0),
  ('A', 'TK/1', 2024, 0),
  ('B', 'K/0', 2024, 0),
  ('B', 'K/1', 2024, 0),
  ('C', 'TK/0', 2024, 0.0025)
ON CONFLICT (category_code, ptkp_status, effective_year) DO NOTHING;

CREATE OR REPLACE FUNCTION public.payroll_calculate_pph21_ter(
  p_monthly_gross numeric,
  p_ptkp_status text DEFAULT 'TK/0',
  p_effective_year integer DEFAULT 2024
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
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
$$;

REVOKE ALL ON FUNCTION public.payroll_calculate_pph21_ter(numeric, text, integer) FROM PUBLIC;

COMMENT ON FUNCTION public.payroll_calculate_pph21_ter IS
  'Phase 2 TER stub. Wire into payroll_calculate_employee when calculation_mode = ter.';
