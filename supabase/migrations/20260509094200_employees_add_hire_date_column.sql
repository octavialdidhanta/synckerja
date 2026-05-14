-- Employees: add hire_date column used by Add Employee flow.
-- Fixes PostgREST PGRST204 schema cache error on insert/upsert.

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS hire_date date NULL;

COMMENT ON COLUMN public.employees.hire_date IS 'Hire date for HR records (can differ from join_date).';

