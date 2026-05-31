-- Dedupe demo org penalty rules: keep one canonical late_arrival rule.
-- Org: Synckerja 663c9336-8cb6-4a36-9ad9-313126e70a1a
-- Run: npm run supabase:db:push:penalty-rules-dedupe

-- Remove penalties tied to duplicate rules (will re-apply on next check-in / manual call)
DELETE FROM public.attendance_penalties ap
USING public.penalty_rules pr
WHERE ap.penalty_rule_id = pr.id
  AND pr.organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid
  AND pr.rule_type = 'late_arrival'
  AND pr.name <> 'Telat melewati toleransi shift';

DELETE FROM public.penalty_rules pr
WHERE pr.organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid
  AND pr.rule_type = 'late_arrival'
  AND pr.name <> 'Telat melewati toleransi shift';

INSERT INTO public.penalty_rules (
  organization_id,
  name,
  rule_type,
  threshold_minutes,
  penalty_amount,
  calculation_type,
  is_active,
  applies_to_all
)
SELECT
  '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid,
  'Telat melewati toleransi shift',
  'late_arrival',
  5,
  50000,
  'fixed',
  true,
  true
WHERE NOT EXISTS (
  SELECT 1
  FROM public.penalty_rules pr
  WHERE pr.organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid
    AND pr.name = 'Telat melewati toleransi shift'
    AND pr.rule_type = 'late_arrival'
);

-- Re-apply single penalty for OCTA demo late record (2026-06-20)
DELETE FROM public.attendance_penalties ap
WHERE ap.attendance_record_id = 'a1a1a1a1-aaaa-4aaa-8aaa-aaaaaaaaaaa1'::uuid;

SELECT public.apply_late_arrival_penalties('a1a1a1a1-aaaa-4aaa-8aaa-aaaaaaaaaaa1'::uuid) AS octa_penalty_reapplied;

SELECT name, threshold_minutes, penalty_amount, is_active
FROM public.penalty_rules
WHERE organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid
  AND rule_type = 'late_arrival';

SELECT e.full_name, COUNT(*) AS penalty_rows, SUM(ap.penalty_amount) AS total
FROM public.attendance_penalties ap
JOIN public.employees e ON e.id = ap.employee_id
WHERE ap.organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid
  AND ap.applied_date = '2026-06-20'::date
  AND e.employee_id = 'EMP-00001'
GROUP BY e.full_name;
