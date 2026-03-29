-- organization_subscriptions: align with product schema (trial/active, billing, limits).
-- Requires: public.subscription_plans (20260401120000), public.organizations.

-- ---------------------------------------------------------------------------
-- payments: minimal table for FK (extend later with Stripe/provider fields).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payments DISABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Add columns (idempotent for columns that may already exist).
-- ---------------------------------------------------------------------------
ALTER TABLE public.organization_subscriptions
  ADD COLUMN IF NOT EXISTS member_count integer NOT NULL DEFAULT 1;

ALTER TABLE public.organization_subscriptions
  ADD COLUMN IF NOT EXISTS is_over_limit boolean NOT NULL DEFAULT false;

ALTER TABLE public.organization_subscriptions
  ADD COLUMN IF NOT EXISTS trial_end_date timestamptz NULL;

ALTER TABLE public.organization_subscriptions
  ADD COLUMN IF NOT EXISTS subscription_end_date timestamptz NULL;

ALTER TABLE public.organization_subscriptions
  ADD COLUMN IF NOT EXISTS billing_cycle text NOT NULL DEFAULT 'monthly';

ALTER TABLE public.organization_subscriptions
  ADD COLUMN IF NOT EXISTS auto_renew boolean NOT NULL DEFAULT true;

ALTER TABLE public.organization_subscriptions
  ADD COLUMN IF NOT EXISTS is_trial boolean NOT NULL DEFAULT true;

ALTER TABLE public.organization_subscriptions
  ADD COLUMN IF NOT EXISTS trial_start_date timestamptz NULL;

ALTER TABLE public.organization_subscriptions
  ADD COLUMN IF NOT EXISTS subscription_start_date timestamptz NULL;

ALTER TABLE public.organization_subscriptions
  ADD COLUMN IF NOT EXISTS last_payment_id uuid NULL;

ALTER TABLE public.organization_subscriptions
  ADD COLUMN IF NOT EXISTS current_member integer NULL DEFAULT 0;

ALTER TABLE public.organization_subscriptions
  ADD COLUMN IF NOT EXISTS subscription_type text NULL;

ALTER TABLE public.organization_subscriptions
  ADD COLUMN IF NOT EXISTS start_date date NULL;

-- FK to payments (add constraint if missing)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'organization_subscriptions_last_payment_id_fkey'
  ) THEN
    ALTER TABLE public.organization_subscriptions
      ADD CONSTRAINT organization_subscriptions_last_payment_id_fkey
      FOREIGN KEY (last_payment_id) REFERENCES public.payments (id);
  END IF;
END $$;

-- Ensure subscription_plan_id FK exists (may already exist from prior migration)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'organization_subscriptions_subscription_plan_id_fkey'
  ) THEN
    ALTER TABLE public.organization_subscriptions
      ADD CONSTRAINT organization_subscriptions_subscription_plan_id_fkey
      FOREIGN KEY (subscription_plan_id) REFERENCES public.subscription_plans (id);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Backfill from legacy plan_key + status, then drop plan_key.
-- ---------------------------------------------------------------------------
UPDATE public.organization_subscriptions os
SET subscription_plan_id = sp.id
FROM public.subscription_plans sp
WHERE os.subscription_plan_id IS NULL
  AND os.plan_key IS NOT NULL
  AND sp.name = os.plan_key;

UPDATE public.organization_subscriptions
SET subscription_type = COALESCE(subscription_type, plan_key)
WHERE plan_key IS NOT NULL AND subscription_type IS NULL;

-- Normalize legacy rows (expressions use pre-update column values).
UPDATE public.organization_subscriptions
SET
  status = CASE
    WHEN status = 'active' THEN 'active'
    WHEN status = 'pending' THEN 'trial'
    ELSE COALESCE(NULLIF(trim(status), ''), 'trial')
  END,
  is_trial = (CASE WHEN status = 'active' THEN false ELSE true END),
  trial_start_date = CASE WHEN status IS DISTINCT FROM 'active' THEN COALESCE(trial_start_date, created_at) ELSE trial_start_date END,
  subscription_start_date = CASE WHEN status = 'active' THEN COALESCE(subscription_start_date, created_at::date) ELSE subscription_start_date END;

UPDATE public.organization_subscriptions os
SET trial_end_date = sub.te
FROM (
  SELECT
    s.id,
    s.trial_start_date + make_interval(days => COALESCE(sp.jumlah_hari_trial, 14)) AS te
  FROM public.organization_subscriptions s
  LEFT JOIN public.subscription_plans sp ON sp.id = s.subscription_plan_id
  WHERE s.is_trial = true
    AND s.trial_start_date IS NOT NULL
    AND s.trial_end_date IS NULL
) sub
WHERE os.id = sub.id;

UPDATE public.organization_subscriptions
SET status = 'trial'
WHERE status IS NULL OR status = '';

ALTER TABLE public.organization_subscriptions
  ALTER COLUMN status SET DEFAULT 'trial';

-- One subscription row per organization
DELETE FROM public.organization_subscriptions os
WHERE os.id IN (
  SELECT s.id
  FROM (
    SELECT id,
      ROW_NUMBER() OVER (PARTITION BY organization_id ORDER BY created_at DESC NULLS LAST) AS rn
    FROM public.organization_subscriptions
  ) s
  WHERE s.rn > 1
);

ALTER TABLE public.organization_subscriptions
  DROP CONSTRAINT IF EXISTS organization_subscriptions_organization_id_unique;

ALTER TABLE public.organization_subscriptions
  ADD CONSTRAINT organization_subscriptions_organization_id_unique UNIQUE (organization_id);

ALTER TABLE public.organization_subscriptions
  DROP COLUMN IF EXISTS plan_key;

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_org_subscriptions_org_status
  ON public.organization_subscriptions USING btree (organization_id, status);

-- ---------------------------------------------------------------------------
-- Trigger helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.refresh_organization_has_active_subscription(p_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ok boolean;
BEGIN
  IF p_org_id IS NULL THEN
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.organization_subscriptions s
    WHERE s.organization_id = p_org_id
      AND (
        (
          s.status = 'trial'
          AND s.is_trial = true
          AND (s.trial_end_date IS NULL OR s.trial_end_date > now())
        )
        OR (
          s.status = 'active'
          AND (s.subscription_end_date IS NULL OR s.subscription_end_date > now())
        )
      )
  )
  INTO v_ok;

  UPDATE public.organizations o
  SET has_active_subscription = COALESCE(v_ok, false)
  WHERE o.id = p_org_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_subscription_over_limit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.current_member IS NOT NULL
     AND NEW.member_count IS NOT NULL
     AND NEW.current_member > NEW.member_count THEN
    NEW.is_over_limit := true;
  ELSIF NEW.current_member IS NOT NULL AND NEW.member_count IS NOT NULL THEN
    NEW.is_over_limit := false;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_organization_subscription_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_has_active_subscription_on_expiry()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  PERFORM public.refresh_organization_has_active_subscription(NEW.organization_id);
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_organization_subscription_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.refresh_organization_has_active_subscription(OLD.organization_id);
  ELSIF TG_OP = 'INSERT' THEN
    PERFORM public.refresh_organization_has_active_subscription(NEW.organization_id);
  ELSE
    PERFORM public.refresh_organization_has_active_subscription(NEW.organization_id);
    IF OLD.organization_id IS DISTINCT FROM NEW.organization_id THEN
      PERFORM public.refresh_organization_has_active_subscription(OLD.organization_id);
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_subscription_status_on_expiry()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.trial_end_date IS NOT NULL
     AND NEW.trial_end_date <= now()
     AND NEW.is_trial = true THEN
    NEW.is_trial := false;
    IF NEW.status = 'trial' THEN
      NEW.status := 'expired';
    END IF;
  END IF;

  IF NEW.subscription_end_date IS NOT NULL
     AND NEW.subscription_end_date <= now()
     AND NEW.status = 'active' THEN
    NEW.status := 'expired';
    NEW.auto_renew := false;
  END IF;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Drop old triggers (by name) then create
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS check_over_limit_on_subscription_update ON public.organization_subscriptions;
DROP TRIGGER IF EXISTS sync_organization_subscription_status_trigger ON public.organization_subscriptions;
DROP TRIGGER IF EXISTS trigger_update_has_active_subscription_on_expiry ON public.organization_subscriptions;
DROP TRIGGER IF EXISTS trigger_update_org_subscription_status_delete ON public.organization_subscriptions;
DROP TRIGGER IF EXISTS trigger_update_org_subscription_status_insert ON public.organization_subscriptions;
DROP TRIGGER IF EXISTS trigger_update_org_subscription_status_update ON public.organization_subscriptions;
DROP TRIGGER IF EXISTS trigger_update_subscription_status_on_expiry ON public.organization_subscriptions;

CREATE TRIGGER check_over_limit_on_subscription_update
  BEFORE UPDATE ON public.organization_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.check_subscription_over_limit();

CREATE TRIGGER sync_organization_subscription_status_trigger
  AFTER INSERT OR DELETE OR UPDATE ON public.organization_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_organization_subscription_status();

CREATE TRIGGER trigger_update_has_active_subscription_on_expiry
  AFTER INSERT OR UPDATE OF trial_end_date, subscription_end_date, is_trial, status
  ON public.organization_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_has_active_subscription_on_expiry();

CREATE TRIGGER trigger_update_org_subscription_status_delete
  AFTER DELETE ON public.organization_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_organization_subscription_status();

CREATE TRIGGER trigger_update_org_subscription_status_insert
  AFTER INSERT ON public.organization_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_organization_subscription_status();

CREATE TRIGGER trigger_update_org_subscription_status_update
  AFTER UPDATE ON public.organization_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_organization_subscription_status();

CREATE TRIGGER trigger_update_subscription_status_on_expiry
  BEFORE INSERT OR UPDATE OF trial_end_date, subscription_end_date, is_trial, status
  ON public.organization_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_subscription_status_on_expiry();

-- Refresh flags for existing rows
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT DISTINCT organization_id FROM public.organization_subscriptions
  LOOP
    PERFORM public.refresh_organization_has_active_subscription(r.organization_id);
  END LOOP;
END $$;
