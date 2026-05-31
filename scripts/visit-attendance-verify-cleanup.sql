-- Remove visit-attendance integration verify seed rows from demo org UI
-- Run after: npm run verify:visit-attendance-integration

DELETE FROM public.attendance_penalties
WHERE attendance_record_id IN (
  SELECT ar.id
  FROM public.attendance_records ar
  WHERE ar.employee_id = '001b6725-bf16-4a2f-81ae-8960cf86c46d'::uuid
    AND (
      ar.attendance_date BETWEEN '2026-06-15'::date AND '2026-06-20'::date
      OR ar.id = 'a6a6a6a6-6666-4666-8666-666666666601'::uuid
    )
);

DELETE FROM public.attendance_records
WHERE employee_id = '001b6725-bf16-4a2f-81ae-8960cf86c46d'::uuid
  AND (
    attendance_date BETWEEN '2026-06-15'::date AND '2026-06-20'::date
    OR id = 'a6a6a6a6-6666-4666-8666-666666666601'::uuid
  );

DELETE FROM public.penalty_exemptions
WHERE id = 'a7a7a7a7-7777-4777-8777-777777777701'::uuid;

DELETE FROM public.client_visits
WHERE id IN (
  'f5f5f5f5-5555-4555-8555-555555555501'::uuid,
  'f5f5f5f5-5555-4555-8555-555555555502'::uuid,
  'f5f5f5f5-5555-4555-8555-555555555503'::uuid,
  'f8f8f8f8-8888-4888-8888-888888888801'::uuid,
  'f9f9f9f9-9999-4999-8999-999999999901'::uuid,
  'f9f9f9f9-9999-4999-8999-999999999902'::uuid
)
OR (
  organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid
  AND visit_purpose ILIKE 'VA verify%'
);

-- Any leftover placeholder photo paths (no storage object)
UPDATE public.client_visits
SET start_photo_path = NULL, end_photo_path = NULL
WHERE start_photo_path = 'verify/photo.jpg'
   OR end_photo_path = 'verify/photo.jpg';

UPDATE public.attendance_records
SET check_in_photo_path = NULL, check_out_photo_path = NULL
WHERE check_in_photo_path = 'verify/photo.jpg'
   OR check_out_photo_path = 'verify/photo.jpg';

SELECT 'visit-attendance verify cleanup done' AS status;
