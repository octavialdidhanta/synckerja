-- Fix Supabase Security Advisor warnings:
-- - Enable RLS on public.payroll_ter_brackets (reference data)
-- - Enable RLS on public._attendance_rules_qa_face_backup (QA helper; should not be exposed)

-- ---------------------------------------------------------------------------
-- payroll_ter_brackets: reference table used by payroll_calculate_pph21_ter_v2
-- Allow authenticated users to read; no write policies (read-only from client).
-- ---------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.payroll_ter_brackets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payroll_ter_brackets_select_authenticated ON public.payroll_ter_brackets;
CREATE POLICY payroll_ter_brackets_select_authenticated
  ON public.payroll_ter_brackets
  FOR SELECT
  TO authenticated
  USING (true);

-- ---------------------------------------------------------------------------
-- _attendance_rules_qa_face_backup: QA backup table created by scripts.
-- Keep it locked down (no policies = deny all for client roles).
-- Service role / postgres can still access for QA scripts.
-- ---------------------------------------------------------------------------
ALTER TABLE IF EXISTS public._attendance_rules_qa_face_backup ENABLE ROW LEVEL SECURITY;

