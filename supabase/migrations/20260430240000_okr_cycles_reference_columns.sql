-- okr_cycles: align with synckerja-reference (types.ts + useCreateOkrCycle / AddObjectiveDialog).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_type WHERE typname = 'okr_period_type') THEN
    CREATE TYPE public.okr_period_type AS ENUM ('yearly', 'half_yearly', 'quarterly');
  END IF;
END $$;

ALTER TABLE public.okr_cycles
  ADD COLUMN IF NOT EXISTS created_by uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_active boolean NULL,
  ADD COLUMN IF NOT EXISTS period_type public.okr_period_type NULL;

-- Backfill period_type while quarter is still integer (if column was integer)
UPDATE public.okr_cycles
SET period_type = CASE
  WHEN quarter IS NULL THEN 'yearly'::public.okr_period_type
  ELSE 'quarterly'::public.okr_period_type
END
WHERE period_type IS NULL;

-- quarter: integer -> text ('q1'..'q4'); no-op if already text
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'okr_cycles'
      AND column_name = 'quarter'
      AND data_type = 'integer'
  ) THEN
    ALTER TABLE public.okr_cycles
      ALTER COLUMN quarter TYPE text USING (
        CASE
          WHEN quarter IS NULL THEN NULL
          ELSE 'q' || quarter::text
        END
      );
  END IF;
END $$;

UPDATE public.okr_cycles oc
SET created_by = COALESCE(
  oc.created_by,
  (SELECT ur.user_id
   FROM public.user_roles ur
   WHERE ur.organization_id = oc.organization_id
   ORDER BY CASE ur.role WHEN 'owner' THEN 1 WHEN 'admin' THEN 2 ELSE 3 END, ur.created_at
   LIMIT 1),
  (SELECT p.user_id FROM public.profiles p WHERE p.active_organization_id = oc.organization_id LIMIT 1),
  (SELECT e.user_id
   FROM public.employees e
   WHERE e.organization_id = oc.organization_id AND e.user_id IS NOT NULL
   LIMIT 1),
  (SELECT uo.user_id FROM public.user_organizations uo WHERE uo.organization_id = oc.organization_id LIMIT 1)
)
WHERE oc.created_by IS NULL;

UPDATE public.okr_cycles SET is_active = COALESCE(is_active, false) WHERE is_active IS NULL;

ALTER TABLE public.okr_cycles ALTER COLUMN period_type SET NOT NULL;
ALTER TABLE public.okr_cycles ALTER COLUMN is_active SET NOT NULL;
ALTER TABLE public.okr_cycles ALTER COLUMN is_active SET DEFAULT false;

-- App always sends created_by; keep nullable only if backfill could not resolve (avoid failed migration)
ALTER TABLE public.okr_cycles ALTER COLUMN period_type SET DEFAULT 'yearly';
