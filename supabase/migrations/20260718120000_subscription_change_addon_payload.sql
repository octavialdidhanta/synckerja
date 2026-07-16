-- Extend subscription_change_requests with add-on / billing payload and apply engine.

ALTER TABLE public.subscription_change_requests
  ADD COLUMN IF NOT EXISTS target_billing_cycle text NULL,
  ADD COLUMN IF NOT EXISTS target_addon_selections jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS current_addon_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS apply_error text NULL,
  ADD COLUMN IF NOT EXISTS applied_at timestamptz NULL;

COMMENT ON COLUMN public.subscription_change_requests.target_addon_selections IS
  'Target catalog add-on state applied at scheduled_date (included + quantity per code).';

COMMENT ON COLUMN public.subscription_change_requests.current_addon_snapshot IS
  'Paid add-on baseline at schedule time for audit.';

CREATE INDEX IF NOT EXISTS idx_subscription_change_requests_pending_due
  ON public.subscription_change_requests (scheduled_date)
  WHERE status = 'pending';

-- Apply pending scheduled changes whose effective date has passed.
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
  v_omni_json jsonb;
  v_lm_json jsonb;
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

      UPDATE public.organization_subscriptions os
      SET
        subscription_plan_id = COALESCE(v_row.target_plan_id, os.subscription_plan_id),
        member_count = v_row.target_member_count,
        billing_cycle = COALESCE(v_row.target_billing_cycle, os.billing_cycle),
        omnichannel_paid_seat_count = v_omni_target,
        lead_magnet_active = v_lm_target,
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

COMMENT ON FUNCTION public.apply_due_subscription_change_requests() IS
  'Applies pending subscription_change_requests whose scheduled_date <= now(). Returns count applied.';

GRANT EXECUTE ON FUNCTION public.apply_due_subscription_change_requests() TO service_role;
GRANT EXECUTE ON FUNCTION public.apply_due_subscription_change_requests() TO authenticated;

-- Allow org subscription managers to cancel pending scheduled changes.
DROP POLICY IF EXISTS "subscription_change_requests_update" ON public.subscription_change_requests;
CREATE POLICY "subscription_change_requests_update"
  ON public.subscription_change_requests FOR UPDATE TO authenticated
  USING (
    organization_id IS NOT NULL
    AND public.user_can_manage_subscription(organization_id)
    AND status = 'pending'
  )
  WITH CHECK (
    organization_id IS NOT NULL
    AND public.user_can_manage_subscription(organization_id)
    AND status IN ('pending', 'cancelled')
  );

-- Hourly apply (when pg_cron available).
DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    BEGIN
      PERFORM cron.unschedule('apply_due_subscription_change_requests');
    EXCEPTION
      WHEN OTHERS THEN NULL;
    END;
    PERFORM cron.schedule(
      'apply_due_subscription_change_requests',
      '15 * * * *',
      $job$SELECT public.apply_due_subscription_change_requests();$job$
    );
  END IF;
END;
$cron$;
