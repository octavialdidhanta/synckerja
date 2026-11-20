-- AI Employee fase 1: jejak penulis plan, pemohon tugas, dan kode KR.
-- ON DELETE SET NULL hanya pada kolom karyawan (PostgreSQL 15+).
-- organization_id tidak ikut dikosongkan.

ALTER TABLE public.social_media_plans
  ADD COLUMN IF NOT EXISTS author_employee_id uuid;

ALTER TABLE public.daily_tasks
  ADD COLUMN IF NOT EXISTS requested_ai_employee_id uuid;

ALTER TABLE public.daily_tasks
  ADD COLUMN IF NOT EXISTS ai_revision_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.key_results
  ADD COLUMN IF NOT EXISTS ai_kr_code text;

ALTER TABLE public.key_results
  DROP CONSTRAINT IF EXISTS key_results_ai_kr_code_check;

ALTER TABLE public.key_results
  ADD CONSTRAINT key_results_ai_kr_code_check
  CHECK (ai_kr_code IS NULL OR ai_kr_code IN ('KR1', 'KR2', 'KR3', 'KR4', 'KR5'));

CREATE UNIQUE INDEX IF NOT EXISTS key_results_ai_kr_code_key
  ON public.key_results (individual_objective_id, ai_kr_code)
  WHERE ai_kr_code IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'social_media_plans_author_org_fkey'
  ) THEN
    ALTER TABLE public.social_media_plans
      ADD CONSTRAINT social_media_plans_author_org_fkey
      FOREIGN KEY (author_employee_id, organization_id)
      REFERENCES public.employees (id, organization_id)
      ON DELETE SET NULL (author_employee_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'daily_tasks_requested_ai_org_fkey'
  ) THEN
    ALTER TABLE public.daily_tasks
      ADD CONSTRAINT daily_tasks_requested_ai_org_fkey
      FOREIGN KEY (requested_ai_employee_id, organization_id)
      REFERENCES public.employees (id, organization_id)
      ON DELETE SET NULL (requested_ai_employee_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS social_media_plans_author_post_date_idx
  ON public.social_media_plans (organization_id, author_employee_id, post_date);

COMMENT ON COLUMN public.social_media_plans.author_employee_id IS
  'Karyawan AI yang menulis plan. Bukan pic_id.';
COMMENT ON COLUMN public.daily_tasks.requested_ai_employee_id IS
  'Karyawan AI yang diminta mengerjakan tugas ad-hoc.';
COMMENT ON COLUMN public.key_results.ai_kr_code IS
  'KR1 sampai KR5 untuk KPI karyawan AI. Tidak mengubah metric_type yang sudah ada.';
