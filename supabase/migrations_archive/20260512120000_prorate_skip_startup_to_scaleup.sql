-- Start Up (starter / start up / startup) → Scale Up: no time-based prorate; charge full list price
-- for the target plan × new member count for the current billing cycle (monthly or yearly).

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
  v_skip_prorate_startup_to_scale boolean := false;
  v_curr_nm       text;
  v_tgt_nm        text;
  v_tgt_list_price numeric;
  v_tgt_annual    numeric;
BEGIN
  SELECT os.id, os.subscription_plan_id, os.member_count, os.billing_cycle,
         os.subscription_start_date, os.subscription_end_date, os.trial_end_date, os.created_at,
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

  IF v_end_ts IS NULL THEN
    v_end_ts := COALESCE(
      v_sub.trial_end_date::timestamptz,
      v_sub.subscription_end_date::timestamptz,
      v_now + CASE WHEN COALESCE(v_sub.billing_cycle, 'monthly') = 'yearly' THEN interval '1 year' ELSE interval '1 month' END
    );
  END IF;

  v_remaining_days := COALESCE(
    CASE
      WHEN v_end_ts IS NULL THEN 0
      ELSE GREATEST(0, FLOOR(EXTRACT(epoch FROM (v_end_ts - v_now)) / 86400.0)::integer)
    END,
    0
  );
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
    SELECT jsonb_build_object(
      'id', id::text,
      'name', name,
      'base_price_per_member', base_price_per_member,
      'annual_discount_percentage', COALESCE(annual_discount_percentage, 0)
    )
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
      'id', v_sub.plan_id::text,
      'name', COALESCE(v_sub.plan_name, 'Unknown'),
      'base_price_per_member', COALESCE(v_sub.base_price_per_member, 0),
      'annual_discount_percentage', 0
    );
    v_is_plan_change := false;
  END IF;

  v_curr_nm := lower(trim(COALESCE(v_sub.plan_name, '')));
  v_tgt_nm := lower(trim(COALESCE(v_target_plan->>'name', '')));
  v_skip_prorate_startup_to_scale := COALESCE(v_is_plan_change, false)
    AND v_curr_nm ~* '(^|[[:space:]])(starter|start[[:space:]]*up|startup)([[:space:]]|$)'
    AND v_tgt_nm ~* 'scale[[:space:]]*up';

  IF v_skip_prorate_startup_to_scale THEN
    v_tgt_annual := COALESCE(NULLIF((v_target_plan->>'annual_discount_percentage'), '')::numeric, 0);
    IF v_sub.billing_cycle = 'yearly' THEN
      v_tgt_list_price := (v_target_plan->>'base_price_per_member')::numeric * new_member_count * 12.0 * (1 - v_tgt_annual / 100.0);
      v_current_daily_rate := (COALESCE(v_sub.base_price_per_member, 0) * v_sub.member_count * 12.0 / 365.0);
      v_target_daily_rate := ((v_target_plan->>'base_price_per_member')::numeric * new_member_count * 12.0 / 365.0);
    ELSE
      v_tgt_list_price := (v_target_plan->>'base_price_per_member')::numeric * new_member_count;
      v_current_daily_rate := (COALESCE(v_sub.base_price_per_member, 0) * v_sub.member_count / 30.0);
      v_target_daily_rate := ((v_target_plan->>'base_price_per_member')::numeric * new_member_count / 30.0);
    END IF;
    v_plan_change_charge := 0;
    v_member_change_charge := 0;
    v_prorate_amount := ROUND(v_tgt_list_price, 0);
    v_prorate_pct := 100;
  ELSE
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

    v_prorate_amount := ROUND((COALESCE(v_plan_change_charge, 0) + COALESCE(v_member_change_charge, 0))::numeric, 0);
  END IF;

  v_is_upgrade := (v_member_diff > 0 OR v_is_plan_change);
  v_charge_now := (COALESCE(v_prorate_amount, 0) > 0 AND v_remaining_days >= 0);
  v_scheduled_date := COALESCE(
    CASE WHEN v_charge_now THEN v_now ELSE v_end_ts END,
    v_now
  );
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
      'current_plan_credit', 0,
      'skip_prorate', v_skip_prorate_startup_to_scale
    )
  );

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.calculate_prorate_upgrade(uuid, integer, uuid) IS
'Prorate upgrade; skip time-prorate for Start Up → Scale Up (full list price for target plan × members).';

REVOKE ALL ON FUNCTION public.calculate_prorate_upgrade(uuid, integer, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.calculate_prorate_upgrade(uuid, integer, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_prorate_upgrade(uuid, integer, uuid) TO service_role;
