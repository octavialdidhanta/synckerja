-- Payroll calculation schema enhancements for stored breakdowns and faster item queries.

ALTER TABLE public.employee_payroll_calculations
  ADD COLUMN IF NOT EXISTS tax_breakdown jsonb NULL,
  ADD COLUMN IF NOT EXISTS calculation_details jsonb NULL,
  ADD COLUMN IF NOT EXISTS total_tax_amount numeric NULL;

COMMENT ON COLUMN public.employee_payroll_calculations.tax_breakdown IS 'PPh21 bracket breakdown for detail UI (no client recalc).';
COMMENT ON COLUMN public.employee_payroll_calculations.calculation_details IS 'Audit: prorate ratio, overtime, tax_method, etc.';
COMMENT ON COLUMN public.employee_payroll_calculations.total_tax_amount IS 'Numeric tax total; complements legacy total_taxes text column.';

UPDATE public.employee_payroll_calculations
SET total_tax_amount = COALESCE(total_tax_deductions, NULLIF(regexp_replace(COALESCE(total_taxes, ''), '[^0-9.]', '', 'g'), '')::numeric)
WHERE total_tax_amount IS NULL
  AND (total_tax_deductions IS NOT NULL OR (total_taxes IS NOT NULL AND total_taxes ~ '^[0-9]+'));

CREATE INDEX IF NOT EXISTS idx_payroll_items_calculation_type
  ON public.payroll_items (payroll_calculation_id, item_type);

-- TER phase 2 foundation
ALTER TABLE public.tax_configurations
  ADD COLUMN IF NOT EXISTS calculation_mode text NOT NULL DEFAULT 'annualized';

ALTER TABLE public.tax_configurations
  DROP CONSTRAINT IF EXISTS tax_configurations_calculation_mode_check;

ALTER TABLE public.tax_configurations
  ADD CONSTRAINT tax_configurations_calculation_mode_check
  CHECK (calculation_mode = ANY (ARRAY['annualized'::text, 'ter'::text]));

COMMENT ON COLUMN public.tax_configurations.calculation_mode IS 'annualized = progressive annual; ter = PP 58/2023 monthly TER (phase 2).';
