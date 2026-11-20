-- Remove orphan Lead Magnet CRM rows created without enrollment link (failed test runs).
-- Keeps leads that have an active lead_submissions row with lead_magnet_enrollment_id.

DELETE FROM public.lead_submissions s
USING public.leads l
WHERE s.lead_id = l.id
  AND (l.source = 'Lead Magnet' OR l.category = 'Lead Magnet')
  AND s.lead_magnet_enrollment_id IS NULL;

DELETE FROM public.leads l
WHERE (l.source = 'Lead Magnet' OR l.category = 'Lead Magnet')
  AND NOT EXISTS (
    SELECT 1
    FROM public.lead_submissions s
    WHERE s.lead_id = l.id
      AND s.is_active = true
      AND s.lead_magnet_enrollment_id IS NOT NULL
  );
