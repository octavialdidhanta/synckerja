-- Rollback 20261101153000_ai_employee_attribution.sql

ALTER TABLE public.social_media_plans
  DROP CONSTRAINT IF EXISTS social_media_plans_author_org_fkey;

ALTER TABLE public.daily_tasks
  DROP CONSTRAINT IF EXISTS daily_tasks_requested_ai_org_fkey;

DROP INDEX IF EXISTS public.social_media_plans_author_post_date_idx;
DROP INDEX IF EXISTS public.key_results_ai_kr_code_key;

ALTER TABLE public.key_results
  DROP CONSTRAINT IF EXISTS key_results_ai_kr_code_check;

ALTER TABLE public.social_media_plans
  DROP COLUMN IF EXISTS author_employee_id;

ALTER TABLE public.daily_tasks
  DROP COLUMN IF EXISTS requested_ai_employee_id;

ALTER TABLE public.daily_tasks
  DROP COLUMN IF EXISTS ai_revision_count;

ALTER TABLE public.key_results
  DROP COLUMN IF EXISTS ai_kr_code;
