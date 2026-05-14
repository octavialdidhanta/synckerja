-- Skema penuh (20260427161000) menyertakan created_at / updated_at + trigger touch.
-- DB tanpa kolom ini memicu Sync: column "updated_at" of relation "analytics_daily_source_breakdown" does not exist.

ALTER TABLE public.analytics_daily_source_breakdown
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.analytics_daily_source_breakdown
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
