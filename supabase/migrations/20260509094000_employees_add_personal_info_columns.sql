-- Employees: add personal info columns required by Add Employee form.
-- Fixes PostgREST 400 / schema cache errors when inserting/upserting employees.

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS birth_place text NULL,
  ADD COLUMN IF NOT EXISTS birth_date date NULL,
  ADD COLUMN IF NOT EXISTS gender text NULL,
  ADD COLUMN IF NOT EXISTS marital_status text NULL,
  ADD COLUMN IF NOT EXISTS religion text NULL,
  ADD COLUMN IF NOT EXISTS postal_code text NULL,
  ADD COLUMN IF NOT EXISTS citizen_address text NULL,
  ADD COLUMN IF NOT EXISTS id_card_file text NULL,
  ADD COLUMN IF NOT EXISTS family_card_file text NULL,
  ADD COLUMN IF NOT EXISTS cv_file text NULL,
  ADD COLUMN IF NOT EXISTS contract_file text NULL,
  ADD COLUMN IF NOT EXISTS certificate_files jsonb NULL;

COMMENT ON COLUMN public.employees.birth_place IS 'Place of birth (free text).';
COMMENT ON COLUMN public.employees.birth_date IS 'Date of birth.';
COMMENT ON COLUMN public.employees.gender IS 'Gender (enum-like text from UI).';
COMMENT ON COLUMN public.employees.marital_status IS 'Marital status (enum-like text from UI).';
COMMENT ON COLUMN public.employees.religion IS 'Religion (enum-like text from UI).';
COMMENT ON COLUMN public.employees.postal_code IS 'Postal code.';
COMMENT ON COLUMN public.employees.citizen_address IS 'Citizen address (KTP address).';
COMMENT ON COLUMN public.employees.id_card_file IS 'Storage path/URL for ID card (KTP) document.';

