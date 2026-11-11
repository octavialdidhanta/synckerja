-- Apply a scheduled Karyawan AI seat change, and refuse a target below the active count.

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
  v_pos_addon_target boolean;
  v_outlet_count integer;
  v_omni_json jsonb;
  v_lm_json jsonb;
  v_pos_json jsonb;
  v_ai_json jsonb;
  v_ai_target integer;
  v_ai_active integer;
BEGIN
  IF current_user IN ('anon', 'authenticated') AND auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;

  FOR v_row IN
    SELECT *
    FROM public.subscription_change_requests
    WHERE status = 'pending'
      AND scheduled_date <= now()
      AND (
        current_user NOT IN ('anon', 'authenticated')
        OR public.user_can_manage_subscription(organization_id)
      )
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
        v_pos_addon_target := COALESCE((v_pos_json ->> 'included')::boolean, false);
        IF v_pos_addon_target THEN
          v_pos_target := GREATEST(0, LEAST(20, COALESCE((v_pos_json ->> 'quantity')::integer, 0)));
        ELSE
          v_pos_target := 0;
        END IF;
      ELSE
        SELECT COALESCE(os.pos_paid_outlet_count, 0), COALESCE(os.pos_addon_active, false)
        INTO v_pos_target, v_pos_addon_target
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

      v_ai_json := v_row.target_addon_selections -> 'ai_employee';
      IF v_ai_json IS NOT NULL AND jsonb_typeof(v_ai_json) = 'object' THEN
        IF COALESCE((v_ai_json ->> 'included')::boolean, false) THEN
          v_ai_target := GREATEST(0, LEAST(50, COALESCE((v_ai_json ->> 'quantity')::integer, 0)));
        ELSE
          v_ai_target := 0;
        END IF;
      ELSE
        SELECT COALESCE(os.ai_employee_paid_seat_count, 0)
        INTO v_ai_target
        FROM public.organization_subscriptions os
        WHERE os.organization_id = v_row.organization_id;
      END IF;

      v_ai_active := public.count_active_ai_employees_for_org(v_row.organization_id);
      IF v_ai_active > v_ai_target THEN
        RAISE EXCEPTION 'active AI employees (%) exceed target seats (%)', v_ai_active, v_ai_target;
      END IF;

      UPDATE public.organization_subscriptions os
      SET
        subscription_plan_id = COALESCE(v_row.target_plan_id, os.subscription_plan_id),
        member_count = v_row.target_member_count,
        billing_cycle = COALESCE(v_row.target_billing_cycle, os.billing_cycle),
        omnichannel_paid_seat_count = v_omni_target,
        lead_magnet_active = v_lm_target,
        pos_paid_outlet_count = v_pos_target,
        pos_addon_active = v_pos_addon_target,
        ai_employee_paid_seat_count = v_ai_target,
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


REVOKE EXECUTE ON FUNCTION public.apply_due_subscription_change_requests() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_due_subscription_change_requests() TO authenticated, service_role;
