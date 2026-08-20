-- POS extra-outlet add-on (per extra cabang / month) + entitlement + RPC.

INSERT INTO public.subscription_add_ons (
  code,
  name,
  description,
  billing_unit,
  default_unit_price_per_month,
  follows_plan_annual_discount,
  is_active
)
VALUES (
  'pos_outlets',
  'POS',
  'Extra POS outlets beyond the included HQ outlet.',
  'per_outlet_month',
  99000,
  true,
  true
)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.subscription_plan_add_ons (subscription_plan_id, add_on_id, display_order)
SELECT sp.id, sa.id, 20
FROM public.subscription_plans sp
CROSS JOIN public.subscription_add_ons sa
WHERE sa.code = 'pos_outlets'
  AND sp.is_active = true
  AND sp.base_price_per_member > 0
  AND lower(trim(sp.name)) <> 'trial'
  AND lower(trim(sp.name)) NOT IN ('business', 'business plan')
  AND NOT (sp.name ~* '(^|[[:space:]])(starter|start[[:space:]]*up|startup)([[:space:]]|$)')
ON CONFLICT (subscription_plan_id, add_on_id) DO NOTHING;

ALTER TABLE public.organization_subscriptions
  ADD COLUMN IF NOT EXISTS pos_paid_outlet_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.organization_subscriptions
  DROP CONSTRAINT IF EXISTS organization_subscriptions_pos_paid_outlet_count_non_negative;

ALTER TABLE public.organization_subscriptions
  ADD CONSTRAINT organization_subscriptions_pos_paid_outlet_count_non_negative
  CHECK (pos_paid_outlet_count >= 0);

COMMENT ON COLUMN public.organization_subscriptions.pos_paid_outlet_count IS
  'Purchased extra POS outlets beyond the included HQ outlet (maxOutlets = 1 + this).';

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS pos_outlets_applied boolean NOT NULL DEFAULT false;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS bundled_pos_outlets_applied boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.payments.pos_outlets_applied IS
  'When true, webhook has already incremented pos_paid_outlet_count for a standalone POS add-on payment (idempotency).';

COMMENT ON COLUMN public.payments.bundled_pos_outlets_applied IS
  'When true, webhook has already applied prorate_details.bundled_pos_outlet_units to organization_subscriptions.pos_paid_outlet_count.';

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
  v_paid_omni integer;
  v_roster_cap integer;
  v_lm_active boolean;
  v_lm_grace timestamptz;
  v_lm_entitled boolean;
  v_paid_pos integer;
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
  v_paid_omni := COALESCE(v_os.omnichannel_paid_seat_count, 0);
  v_roster_cap := LEAST(COALESCE(v_os.member_count, 0), v_paid_omni);
  v_lm_active := COALESCE(v_os.lead_magnet_active, false);
  v_lm_grace := v_os.lead_magnet_grace_until;
  v_lm_entitled := v_lm_active OR (v_lm_grace IS NOT NULL AND v_lm_grace > v_now);
  v_paid_pos := COALESCE(v_os.pos_paid_outlet_count, 0);

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
    'billing_term_months', public._coerce_billing_term_months(v_os.billing_term_months),
    'base_price_per_member', v_base_price,
    'next_payment_date', v_next_payment,
    'omnichannel_paid_seat_count', v_paid_omni,
    'omnichannel_roster_seat_cap', v_roster_cap,
    'lead_magnet_active', v_lm_active,
    'lead_magnet_grace_until', v_lm_grace,
    'lead_magnet_entitled', v_lm_entitled,
    'pos_paid_outlet_count', v_paid_pos
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_due_subscription_change_requests()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.subscription_change_requests%ROWTYPE;
  v_applied integer := 0;
  v_employees integer;
  v_roster integer;
  v_omni_target integer;
  v_lm_target boolean;
  v_pos_target integer;
  v_outlet_count integer;
  v_omni_json jsonb;
  v_lm_json jsonb;
  v_pos_json jsonb;
BEGIN
  FOR v_row IN
    SELECT *
    FROM public.subscription_change_requests
    WHERE status = 'pending'
      AND scheduled_date <= now()
    ORDER BY scheduled_date ASC
    FOR UPDATE SKIP LOCKED
  LOOP
    BEGIN
      v_employees := public.count_active_employees_for_org(v_row.organization_id);
      IF v_employees > v_row.target_member_count THEN
        RAISE EXCEPTION 'active employees (%) exceed target member count (%)', v_employees, v_row.target_member_count;
      END IF;

      v_omni_json := v_row.target_addon_selections -> 'omnichannel_roster';
      IF v_omni_json IS NOT NULL AND jsonb_typeof(v_omni_json) = 'object' THEN
        IF COALESCE((v_omni_json ->> 'included')::boolean, false) THEN
          v_omni_target := GREATEST(0, COALESCE((v_omni_json ->> 'quantity')::integer, 0));
        ELSE
          v_omni_target := 0;
        END IF;
      ELSE
        SELECT COALESCE(os.omnichannel_paid_seat_count, 0)
        INTO v_omni_target
        FROM public.organization_subscriptions os
        WHERE os.organization_id = v_row.organization_id;
      END IF;

      SELECT COUNT(*)::integer
      INTO v_roster
      FROM public.organization_omnichannel_staff oos
      WHERE oos.organization_id = v_row.organization_id;

      IF v_roster > v_omni_target THEN
        RAISE EXCEPTION 'omnichannel roster (%) exceeds target paid seats (%)', v_roster, v_omni_target;
      END IF;

      v_lm_json := v_row.target_addon_selections -> 'lead_magnet';
      IF v_lm_json IS NOT NULL AND jsonb_typeof(v_lm_json) = 'object' THEN
        v_lm_target := COALESCE((v_lm_json ->> 'included')::boolean, false);
      ELSE
        SELECT COALESCE(os.lead_magnet_active, false)
        INTO v_lm_target
        FROM public.organization_subscriptions os
        WHERE os.organization_id = v_row.organization_id;
      END IF;

      v_pos_json := v_row.target_addon_selections -> 'pos_outlets';
      IF v_pos_json IS NOT NULL AND jsonb_typeof(v_pos_json) = 'object' THEN
        IF COALESCE((v_pos_json ->> 'included')::boolean, false) THEN
          v_pos_target := GREATEST(0, LEAST(20, COALESCE((v_pos_json ->> 'quantity')::integer, 0)));
        ELSE
          v_pos_target := 0;
        END IF;
      ELSE
        SELECT COALESCE(os.pos_paid_outlet_count, 0)
        INTO v_pos_target
        FROM public.organization_subscriptions os
        WHERE os.organization_id = v_row.organization_id;
      END IF;

      SELECT COUNT(*)::integer
      INTO v_outlet_count
      FROM public.pos_outlets po
      WHERE po.organization_id = v_row.organization_id
        AND COALESCE(po.is_deleted, false) = false;

      IF v_outlet_count > (1 + v_pos_target) THEN
        RAISE EXCEPTION 'active outlets (%) exceed POS quota (%)', v_outlet_count, (1 + v_pos_target);
      END IF;

      UPDATE public.organization_subscriptions os
      SET
        subscription_plan_id = COALESCE(v_row.target_plan_id, os.subscription_plan_id),
        member_count = v_row.target_member_count,
        billing_cycle = COALESCE(v_row.target_billing_cycle, os.billing_cycle),
        omnichannel_paid_seat_count = v_omni_target,
        lead_magnet_active = v_lm_target,
        pos_paid_outlet_count = v_pos_target,
        updated_at = now()
      WHERE os.organization_id = v_row.organization_id;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'organization subscription not found';
      END IF;

      UPDATE public.subscription_change_requests
      SET status = 'applied', applied_at = now(), apply_error = NULL
      WHERE id = v_row.id;

      v_applied := v_applied + 1;
    EXCEPTION
      WHEN OTHERS THEN
        UPDATE public.subscription_change_requests
        SET status = 'failed', apply_error = SQLERRM, applied_at = now()
        WHERE id = v_row.id;
    END;
  END LOOP;

  RETURN v_applied;
END;
$$;
