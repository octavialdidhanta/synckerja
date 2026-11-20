-- Drop the unused PPh21 TER v1 stub.
--
-- payroll_calculate_pph21_ter(numeric, text, integer) was a "Phase 2 TER stub" from
-- 20260530160000_payroll_ter_tax_foundation.sql. It reads only one rate per PTKP status
-- and returns 0 tax for years without seeded rows (e.g. 2026), so any future caller
-- would silently under-withhold. Nothing calls it: no function, view or trigger in the
-- database, and no frontend or edge-function code. Payroll uses
-- payroll_calculate_employee -> payroll_calculate_pph21_ter_v2 / payroll_calculate_tax_by_method.
--
-- Rollback: supabase/rollback/20261120_drop_payroll_pph21_ter_v1_stub_rollback.sql

DROP FUNCTION IF EXISTS public.payroll_calculate_pph21_ter(numeric, text, integer);
