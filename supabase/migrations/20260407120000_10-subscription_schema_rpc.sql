-- Subscription module: payments (Midtrans), analytics tables, RPCs, RLS for owner/admin payment access.

-- ---------------------------------------------------------------------------
-- 1) employee_statuses (for active employee counts)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.employee_statuses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  CONSTRAINT employee_statuses_name_unique UNIQUE (name)
);

ALTER TABLE public.employee_statuses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "employee_statuses_select_authenticated" ON public.employee_statuses;
CREATE POLICY "employee_statuses_select_authenticated"
  ON public.employee_statuses FOR SELECT TO authenticated
  USING (true);

INSERT INTO public.employee_statuses (name)
SELECT v FROM (VALUES ('active'), ('probation'), ('terminated')) AS t(v)
WHERE NOT EXISTS (SELECT 1 FROM public.employee_statuses es WHERE es.name = t.v);

-- ---------------------------------------------------------------------------
-- 2) employees — columns for org scope, webhook removals, analytics
-- ---------------------------------------------------------------------------
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS organization_id uuid NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS employee_status_id uuid NULL REFERENCES public.employee_statuses (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pending_removal boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pending_removal_reason text NULL,
  ADD COLUMN IF NOT EXISTS pending_removal_date timestamptz NULL,
  ADD COLUMN IF NOT EXISTS status text NULL,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_employees_organization_id ON public.employees (organization_id);

DROP POLICY IF EXISTS "employees_select_same_organization" ON public.employees;
CREATE POLICY "employees_select_same_organization"
  ON public.employees FOR SELECT TO authenticated
  USING (
    organization_id IS NOT NULL
    AND organization_id IN (SELECT public.user_organization_ids())
  );

-- ---------------------------------------------------------------------------
-- 3) activities (subscription analytics)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.activities (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  activity_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_activities_org_created ON public.activities (organization_id, created_at DESC);

ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "activities_select_org" ON public.activities;
CREATE POLICY "activities_select_org"
  ON public.activities FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "activities_insert_org" ON public.activities;
CREATE POLICY "activities_insert_org"
  ON public.activities FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

-- ---------------------------------------------------------------------------
-- 4) payments — columns required by Midtrans edge functions
-- ---------------------------------------------------------------------------
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS order_id text NULL,
  ADD COLUMN IF NOT EXISTS user_id uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS organization_id uuid NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS plan_id uuid NULL REFERENCES public.subscription_plans (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS amount numeric NULL,
  ADD COLUMN IF NOT EXISTS member_count integer NULL,
  ADD COLUMN IF NOT EXISTS billing_cycle text NULL,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS payment_type text NULL,
  ADD COLUMN IF NOT EXISTS prorate_details jsonb NULL,
  ADD COLUMN IF NOT EXISTS midtrans_token text NULL,
  ADD COLUMN IF NOT EXISTS transaction_id text NULL,
  ADD COLUMN IF NOT EXISTS fraud_status text NULL,
  ADD COLUMN IF NOT EXISTS settlement_time timestamptz NULL,
  ADD COLUMN IF NOT EXISTS transaction_time timestamptz NULL,
  ADD COLUMN IF NOT EXISTS bank text NULL,
  ADD COLUMN IF NOT EXISTS approval_code text NULL,
  ADD COLUMN IF NOT EXISTS webhook_received_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS subscription_start_date timestamptz NULL,
  ADD COLUMN IF NOT EXISTS subscription_end_date timestamptz NULL,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_order_id_unique ON public.payments (order_id) WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_org_status ON public.payments (organization_id, status);

-- ---------------------------------------------------------------------------
-- 5) Helper: owner/admin subscription management
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.user_can_manage_subscription(p_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.organization_id = p_org_id
      AND lower(trim(ur.role)) IN ('owner', 'admin')
  );
$$;

REVOKE ALL ON FUNCTION public.user_can_manage_subscription(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_can_manage_subscription(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 6) payments RLS — replace narrow policy; subscription admins see org payments
-- ---------------------------------------------------------------------------
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payments_select_for_org_members" ON public.payments;
DROP POLICY IF EXISTS "payments_select_subscription_admins" ON public.payments;

CREATE POLICY "payments_select_subscription_admins"
  ON public.payments FOR SELECT TO authenticated
  USING (
    organization_id IS NOT NULL
    AND public.user_can_manage_subscription(organization_id)
  );

-- ---------------------------------------------------------------------------
-- 7) subscription_change_requests
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subscription_change_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  current_plan_id uuid NULL REFERENCES public.subscription_plans (id) ON DELETE SET NULL,
  target_plan_id uuid NULL REFERENCES public.subscription_plans (id) ON DELETE SET NULL,
  current_member_count integer NOT NULL,
  target_member_count integer NOT NULL,
  change_type text NOT NULL,
  scheduled_date timestamptz NOT NULL,
  prorate_amount numeric NOT NULL DEFAULT 0,
  charge_now boolean NOT NULL DEFAULT false,
  requested_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscription_change_requests_org ON public.subscription_change_requests (organization_id);

ALTER TABLE public.subscription_change_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "subscription_change_requests_select" ON public.subscription_change_requests;
CREATE POLICY "subscription_change_requests_select"
  ON public.subscription_change_requests FOR SELECT TO authenticated
  USING (
    organization_id IS NOT NULL
    AND public.user_can_manage_subscription(organization_id)
  );

DROP POLICY IF EXISTS "subscription_change_requests_insert" ON public.subscription_change_requests;
CREATE POLICY "subscription_change_requests_insert"
  ON public.subscription_change_requests FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IS NOT NULL
    AND public.user_can_manage_subscription(organization_id)
    AND requested_by = auth.uid()
  );

-- ---------------------------------------------------------------------------
-- 8) Active employee count helper (SECURITY DEFINER for RPC reuse)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.count_active_employees_for_org(p_org_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT count(*)::integer
    FROM public.employees e
    WHERE e.organization_id = p_org_id
      AND COALESCE(e.pending_removal, false) = false
      AND (
        e.employee_status_id IS NULL
        OR EXISTS (
          SELECT 1 FROM public.employee_statuses es
          WHERE es.id = e.employee_status_id
            AND lower(es.name) IN ('active', 'probation')
        )
      )
  ), 0);
$$;

REVOKE ALL ON FUNCTION public.count_active_employees_for_org(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.count_active_employees_for_org(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.count_active_employees_for_org(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- 9) calculate_prorate_upgrade (from synckerja-reference migrations)
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.calculate_prorate_upgrade(uuid, integer, uuid);

CREATE OR REPLACE FUNCTION public.calculate_prorate_upgrade(
  org_id uuid,
  new_member_count integer,
  target_plan_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub           record;
  v_payment       record;
  v_current_plan  jsonb;
  v_target_plan   jsonb;
  v_end_ts        timestamptz;
  v_start_ts      timestamptz;
  v_now           timestamptz := now();
  v_total_days    integer;
  v_remaining_days integer;
  v_prorate_pct   numeric;
  v_member_diff   integer;
  v_is_plan_change boolean;
  v_is_upgrade    boolean;
  v_plan_change_charge numeric := 0;
  v_member_change_charge numeric := 0;
  v_prorate_amount numeric := 0;
  v_charge_now    boolean;
  v_change_type   text;
  v_scheduled_date timestamptz;
  v_current_daily_rate numeric;
  v_target_daily_rate numeric;
  v_result        jsonb;
  v_os_end        timestamptz;
  v_payment_period_end timestamptz;
  v_last_paid_amount numeric;
  v_last_paid_member_count integer;
BEGIN
  SELECT os.id, os.subscription_plan_id, os.member_count, os.billing_cycle,
         os.subscription_start_date, os.subscription_end_date, os.created_at,
         sp.id AS plan_id, sp.name AS plan_name, sp.base_price_per_member
  INTO v_sub
  FROM organization_subscriptions os
  LEFT JOIN subscription_plans sp ON sp.id = os.subscription_plan_id
  WHERE os.organization_id = org_id
  ORDER BY os.updated_at DESC
  LIMIT 1;

  IF v_sub.id IS NULL THEN
    RETURN jsonb_build_object('error', 'No active subscription found for organization');
  END IF;

  SELECT p.subscription_end_date, p.subscription_start_date, p.created_at, p.billing_cycle,
         p.amount, p.member_count
  INTO v_payment
  FROM payments p
  WHERE p.organization_id = org_id
    AND p.status IN ('success', 'settlement', 'paid')
    AND p.created_at IS NOT NULL
    AND p.created_at <= v_now
  ORDER BY p.created_at DESC
  LIMIT 1;

  IF FOUND AND v_payment.amount IS NOT NULL THEN
    v_last_paid_amount := (v_payment.amount)::numeric;
    v_last_paid_member_count := COALESCE((v_payment.member_count)::integer, v_sub.member_count);
  ELSE
    v_last_paid_amount := NULL;
    v_last_paid_member_count := NULL;
  END IF;

  IF FOUND AND v_payment.subscription_end_date IS NOT NULL THEN
    v_end_ts := (v_payment.subscription_end_date)::timestamptz;
    IF v_payment.created_at IS NOT NULL THEN
      IF (COALESCE(v_payment.billing_cycle, v_sub.billing_cycle) = 'yearly' AND v_end_ts > (v_payment.created_at)::timestamptz + interval '1 year' + interval '1 day')
         OR (COALESCE(v_payment.billing_cycle, v_sub.billing_cycle) != 'yearly' AND v_end_ts > (v_payment.created_at)::timestamptz + interval '1 month' + interval '1 day') THEN
        v_end_ts := (v_payment.created_at)::timestamptz + CASE WHEN COALESCE(v_payment.billing_cycle, v_sub.billing_cycle) = 'yearly' THEN interval '1 year' ELSE interval '1 month' END;
      END IF;
    END IF;
    IF v_payment.subscription_start_date IS NOT NULL THEN
      v_start_ts := (v_payment.subscription_start_date)::timestamptz;
    ELSE
      v_start_ts := (COALESCE(v_sub.subscription_start_date::timestamptz, v_sub.created_at::timestamptz));
    END IF;
  ELSIF FOUND AND v_payment.created_at IS NOT NULL THEN
    v_end_ts := (v_payment.created_at)::timestamptz + CASE
      WHEN COALESCE(v_payment.billing_cycle, v_sub.billing_cycle) = 'yearly' THEN interval '1 year'
      ELSE interval '1 month'
    END;
    v_start_ts := (v_payment.created_at)::timestamptz;
  ELSE
    v_end_ts := (v_sub.subscription_end_date)::timestamptz;
    v_start_ts := (COALESCE(v_sub.subscription_start_date::timestamptz, v_sub.created_at::timestamptz));
  END IF;

  IF v_sub.subscription_end_date IS NOT NULL THEN
    v_os_end := (v_sub.subscription_end_date)::timestamptz;
    IF v_os_end > v_now THEN
      IF FOUND AND v_payment.created_at IS NOT NULL THEN
        v_payment_period_end := (v_payment.created_at)::timestamptz + CASE
          WHEN COALESCE(v_payment.billing_cycle, v_sub.billing_cycle) = 'yearly' THEN interval '1 year' + interval '31 days'
          ELSE interval '1 month' + interval '5 days'
        END;
        IF v_os_end <= v_payment_period_end THEN
          v_end_ts := v_os_end;
        END IF;
      ELSIF v_os_end <= v_now + interval '2 years' THEN
        v_end_ts := v_os_end;
      END IF;
    END IF;
  END IF;

  v_remaining_days := GREATEST(0, (EXTRACT(epoch FROM (v_end_ts - v_now)) / 86400)::integer);
  v_member_diff := new_member_count - v_sub.member_count;

  IF v_sub.billing_cycle = 'yearly' THEN
    v_total_days := 365;
  ELSE
    v_total_days := 30;
  END IF;

  v_prorate_pct := CASE WHEN v_total_days > 0 THEN (v_remaining_days::numeric / v_total_days) * 100 ELSE 0 END;

  v_current_plan := jsonb_build_object(
    'id', v_sub.plan_id,
    'name', COALESCE(v_sub.plan_name, 'Unknown'),
    'member_count', v_sub.member_count,
    'base_price_per_member', COALESCE(v_sub.base_price_per_member, 0),
    'billing_cycle', COALESCE(v_sub.billing_cycle, 'monthly'),
    'end_date', v_end_ts
  );

  IF target_plan_id IS NOT NULL AND target_plan_id IS DISTINCT FROM v_sub.subscription_plan_id THEN
    SELECT jsonb_build_object('id', id, 'name', name, 'base_price_per_member', base_price_per_member)
    INTO v_target_plan
    FROM subscription_plans
    WHERE id = target_plan_id AND is_active = true
    LIMIT 1;
    IF NOT FOUND OR v_target_plan IS NULL THEN
      RETURN jsonb_build_object('error', 'Target plan not found or inactive');
    END IF;
    v_is_plan_change := true;
  ELSE
    v_target_plan := jsonb_build_object(
      'id', v_sub.plan_id,
      'name', COALESCE(v_sub.plan_name, 'Unknown'),
      'base_price_per_member', COALESCE(v_sub.base_price_per_member, 0)
    );
    v_is_plan_change := false;
  END IF;

  IF v_sub.billing_cycle = 'yearly' THEN
    v_current_daily_rate := (COALESCE(v_sub.base_price_per_member, 0) * v_sub.member_count * 12.0 / 365.0);
  ELSE
    v_current_daily_rate := (COALESCE(v_sub.base_price_per_member, 0) * v_sub.member_count / 30.0);
  END IF;

  IF v_is_plan_change THEN
    v_target_daily_rate := (v_target_plan->>'base_price_per_member')::numeric * new_member_count;
    IF v_sub.billing_cycle = 'yearly' THEN
      v_target_daily_rate := v_target_daily_rate * 12.0 / 365.0;
    ELSE
      v_target_daily_rate := v_target_daily_rate / 30.0;
    END IF;
    v_plan_change_charge := GREATEST(0, (v_target_daily_rate - v_current_daily_rate) * v_remaining_days);
  ELSE
    v_target_daily_rate := v_current_daily_rate;
  END IF;

  IF v_member_diff > 0 THEN
    IF v_sub.billing_cycle = 'yearly' THEN
      v_member_change_charge := (COALESCE(v_sub.base_price_per_member, 0) * 12.0) * v_member_diff * (v_remaining_days::numeric / 365.0);
    ELSE
      v_member_change_charge := (COALESCE(v_sub.base_price_per_member, 0) * v_member_diff * v_remaining_days::numeric / 30.0);
    END IF;
  END IF;

  v_prorate_amount := ROUND((v_plan_change_charge + v_member_change_charge)::numeric, 0);
  v_is_upgrade := (v_member_diff > 0 OR v_is_plan_change);
  v_charge_now := (v_prorate_amount > 0 AND v_remaining_days >= 0);
  v_scheduled_date := CASE WHEN v_charge_now THEN v_now ELSE v_end_ts END;
  v_change_type := CASE
    WHEN v_member_diff > 0 AND NOT v_is_plan_change THEN 'member_increase'
    WHEN v_is_plan_change AND v_member_diff >= 0 THEN 'upgrade'
    WHEN v_is_plan_change AND v_member_diff < 0 THEN 'downgrade'
    ELSE 'downgrade'
  END;

  v_result := jsonb_build_object(
    'success', true,
    'current_plan', v_current_plan,
    'target_plan', jsonb_build_object(
      'id', v_target_plan->>'id',
      'name', v_target_plan->>'name',
      'base_price_per_member', (v_target_plan->>'base_price_per_member')::numeric
    ),
    'last_paid_amount', v_last_paid_amount,
    'last_paid_member_count', v_last_paid_member_count,
    'calculation', jsonb_build_object(
      'new_member_count', new_member_count,
      'member_difference', v_member_diff,
      'remaining_days', v_remaining_days,
      'total_days', v_total_days,
      'prorate_percentage', ROUND(v_prorate_pct, 2),
      'prorate_amount', v_prorate_amount,
      'plan_change_charge', ROUND(v_plan_change_charge, 0),
      'member_change_charge', ROUND(v_member_change_charge, 0),
      'is_upgrade', v_is_upgrade,
      'is_plan_change', v_is_plan_change,
      'charge_now', v_charge_now,
      'change_type', v_change_type,
      'scheduled_date', to_char(v_scheduled_date AT TIME ZONE 'UTC', 'YYYY-MM-DD''T''HH24:MI:SS.MS''Z'''),
      'current_daily_rate', ROUND(v_current_daily_rate, 2),
      'target_daily_rate', ROUND(COALESCE(v_target_daily_rate, v_current_daily_rate), 2),
      'current_plan_credit', 0
    )
  );

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.calculate_prorate_upgrade(uuid, integer, uuid) IS
'Prorate upgrade; used by calculate-prorate edge function.';

REVOKE ALL ON FUNCTION public.calculate_prorate_upgrade(uuid, integer, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.calculate_prorate_upgrade(uuid, integer, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_prorate_upgrade(uuid, integer, uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- 10) get_subscription_status
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_subscription_status(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_os record;
  v_employee_count integer;
  v_member_limit integer;
  v_plan_name text;
  v_base_price numeric;
  v_now timestamptz := now();
  v_end timestamptz;
  v_days int;
  v_is_trial boolean;
  v_is_expired boolean;
  v_is_active boolean;
  v_status text;
  v_over boolean;
  v_next_payment timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_organizations uo
    WHERE uo.user_id = auth.uid() AND uo.organization_id = p_org_id
  ) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT os.*, sp.name AS sp_name, sp.base_price_per_member AS sp_bpp
  INTO v_os
  FROM public.organization_subscriptions os
  LEFT JOIN public.subscription_plans sp ON sp.id = os.subscription_plan_id
  WHERE os.organization_id = p_org_id
  LIMIT 1;

  IF v_os.id IS NULL THEN
    RETURN NULL;
  END IF;

  v_member_limit := COALESCE(v_os.member_count, 1);
  v_plan_name := COALESCE(v_os.sp_name, 'Plan');
  v_base_price := COALESCE(v_os.sp_bpp, 0);
  v_is_trial := COALESCE(v_os.is_trial, false);

  v_employee_count := public.count_active_employees_for_org(p_org_id);
  v_over := v_employee_count > v_member_limit;

  IF v_is_trial THEN
    v_end := v_os.trial_end_date;
  ELSE
    v_end := v_os.subscription_end_date;
  END IF;

  IF v_end IS NOT NULL AND v_end < v_now THEN
    v_is_expired := true;
    v_days := 0;
  ELSIF v_end IS NOT NULL THEN
    v_is_expired := false;
    v_days := GREATEST(0, FLOOR(EXTRACT(epoch FROM (v_end - v_now)) / 86400.0)::integer);
  ELSE
    v_is_expired := false;
    v_days := 9999;
  END IF;

  v_status := COALESCE(v_os.status, 'trial');
  IF v_is_expired THEN
    v_status := 'expired';
  END IF;

  v_is_active := NOT v_is_expired AND (
    (v_is_trial AND (v_os.trial_end_date IS NULL OR v_os.trial_end_date > v_now))
    OR (
      NOT v_is_trial
      AND v_os.status = 'active'
      AND (v_os.subscription_end_date IS NULL OR v_os.subscription_end_date > v_now)
    )
  );

  SELECT p.subscription_end_date INTO v_next_payment
  FROM public.payments p
  WHERE p.organization_id = p_org_id
    AND p.status IN ('success', 'settlement', 'paid')
  ORDER BY p.created_at DESC
  LIMIT 1;

  IF v_next_payment IS NULL THEN
    v_next_payment := v_os.subscription_end_date;
  END IF;

  RETURN jsonb_build_object(
    'status', v_status,
    'plan_name', v_plan_name,
    'is_trial', v_is_trial,
    'is_active', v_is_active,
    'is_expired', v_is_expired,
    'employee_count', v_employee_count,
    'member_limit', v_member_limit,
    'is_over_limit', v_over,
    'days_remaining', v_days,
    'end_date', v_end,
    'subscription_start_date', v_os.subscription_start_date,
    'subscription_end_date', v_os.subscription_end_date,
    'trial_end_date', v_os.trial_end_date,
    'billing_cycle', COALESCE(v_os.billing_cycle, 'monthly'),
    'base_price_per_member', v_base_price,
    'next_payment_date', v_next_payment
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_subscription_status(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_subscription_status(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 11) can_add_employee
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_add_employee(p_org_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer;
  v_count integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_organizations uo
    WHERE uo.user_id = auth.uid() AND uo.organization_id = p_org_id
  ) THEN
    RETURN false;
  END IF;

  SELECT os.member_count INTO v_limit
  FROM public.organization_subscriptions os
  WHERE os.organization_id = p_org_id
  LIMIT 1;

  IF v_limit IS NULL THEN
    RETURN false;
  END IF;

  v_count := public.count_active_employees_for_org(p_org_id);
  RETURN v_count < v_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.can_add_employee(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_add_employee(uuid) TO authenticated;
