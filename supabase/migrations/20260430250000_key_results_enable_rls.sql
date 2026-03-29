-- Security Advisor: "Policy Exists RLS Disabled" / "RLS Disabled in Public" on public.key_results.
-- Ensures RLS is on when policies already exist (e.g. partial apply or manual DDL out of order).

ALTER TABLE IF EXISTS public.key_results ENABLE ROW LEVEL SECURITY;
