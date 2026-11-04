-- Angkat batas panggilan model karyawan AI dari 15 menjadi 1000.
-- Status coaching tetap 8. Batas script organisasi ini ikut menjadi 1000.

DO $$
DECLARE
  src text;
BEGIN
  src := pg_get_functiondef('public.ai_employee_reserve_model_call(uuid,uuid,boolean)'::regprocedure);
  src := replace(src, 'THEN 8 ELSE 15 END', 'THEN 8 ELSE 1000 END');
  EXECUTE src;

  src := pg_get_functiondef('public.ai_employee_page_read(uuid)'::regprocedure);
  src := replace(src, 'THEN 8 ELSE 15 END', 'THEN 8 ELSE 1000 END');
  EXECUTE src;
END $$;

UPDATE public.organization_script_ai_config
SET daily_limit = 1000
WHERE organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'
  AND daily_limit IS DISTINCT FROM 1000;
