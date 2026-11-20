-- Shift recap email: org toggle, dispatch queue, enqueue RPC, patch pos_end_shift

ALTER TABLE public.operational_email_notification_settings
  ADD COLUMN IF NOT EXISTS shift_recap_email_enabled boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.operational_email_notification_settings.shift_recap_email_enabled IS
  'Send shift recap email when a cashier closes a shift on POS tablet.';

-- ---------------------------------------------------------------------------
-- Dispatch queue (one row per closed shift)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pos_shift_email_dispatches (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  shift_id uuid NOT NULL REFERENCES public.pos_cashier_shifts (id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  outlet_id uuid NOT NULL REFERENCES public.pos_outlets (id) ON DELETE CASCADE,
  language text NOT NULL DEFAULT 'id',
  status text NOT NULL DEFAULT 'pending_send',
  recipient_count integer,
  resend_message_id text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  CONSTRAINT pos_shift_email_dispatches_pkey PRIMARY KEY (id),
  CONSTRAINT pos_shift_email_dispatches_shift_id_key UNIQUE (shift_id),
  CONSTRAINT pos_shift_email_dispatches_status_check CHECK (
    status IN ('pending_send', 'sent', 'send_failed', 'skipped_disabled')
  )
);

CREATE INDEX IF NOT EXISTS idx_pos_shift_email_dispatches_org_created
  ON public.pos_shift_email_dispatches (organization_id, created_at DESC);

ALTER TABLE public.pos_shift_email_dispatches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pos_shift_email_dispatches_org_select" ON public.pos_shift_email_dispatches;
CREATE POLICY "pos_shift_email_dispatches_org_select"
  ON public.pos_shift_email_dispatches FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

COMMENT ON TABLE public.pos_shift_email_dispatches IS
  'Queue + audit log for automatic shift recap emails after pos_end_shift.';

-- ---------------------------------------------------------------------------
-- Enqueue (idempotent per shift)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enqueue_pos_shift_recap_email(
  p_shift_id uuid,
  p_language text DEFAULT 'id'
)
RETURNS public.pos_shift_email_dispatches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shift public.pos_cashier_shifts;
  v_enabled boolean := true;
  v_lang text := COALESCE(NULLIF(btrim(p_language), ''), 'id');
  v_row public.pos_shift_email_dispatches;
BEGIN
  SELECT * INTO v_shift FROM public.pos_cashier_shifts WHERE id = p_shift_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'shift_not_found';
  END IF;

  SELECT COALESCE(s.shift_recap_email_enabled, true) INTO v_enabled
  FROM public.operational_email_notification_settings s
  WHERE s.organization_id = v_shift.organization_id;

  IF NOT COALESCE(v_enabled, true) THEN
    INSERT INTO public.pos_shift_email_dispatches (
      shift_id,
      organization_id,
      outlet_id,
      language,
      status
    )
    VALUES (
      v_shift.id,
      v_shift.organization_id,
      v_shift.outlet_id,
      v_lang,
      'skipped_disabled'
    )
    ON CONFLICT (shift_id) DO UPDATE SET
      language = EXCLUDED.language
    RETURNING * INTO v_row;

    RETURN v_row;
  END IF;

  INSERT INTO public.pos_shift_email_dispatches (
    shift_id,
    organization_id,
    outlet_id,
    language,
    status
  )
  VALUES (
    v_shift.id,
    v_shift.organization_id,
    v_shift.outlet_id,
    v_lang,
    'pending_send'
  )
  ON CONFLICT (shift_id) DO UPDATE SET
    language = EXCLUDED.language
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_pos_shift_recap_email(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enqueue_pos_shift_recap_email(uuid, text) TO authenticated;

-- Client updates language before fast-path dispatch invoke
CREATE OR REPLACE FUNCTION public.update_pos_shift_email_dispatch_language(
  p_shift_id uuid,
  p_language text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shift public.pos_cashier_shifts;
BEGIN
  SELECT * INTO v_shift FROM public.pos_cashier_shifts WHERE id = p_shift_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'shift_not_found';
  END IF;
  IF v_shift.organization_id NOT IN (SELECT public.user_organization_ids()) THEN
    RAISE EXCEPTION 'forbidden_org';
  END IF;

  UPDATE public.pos_shift_email_dispatches
  SET language = COALESCE(NULLIF(btrim(p_language), ''), 'id')
  WHERE shift_id = p_shift_id;
END;
$$;

REVOKE ALL ON FUNCTION public.update_pos_shift_email_dispatch_language(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_pos_shift_email_dispatch_language(uuid, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- Patch pos_end_shift: enqueue recap email after close
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pos_end_shift(
  p_shift_id uuid,
  p_closing_cash numeric
)
RETURNS public.pos_cashier_shifts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_row public.pos_cashier_shifts;
  v_expected numeric;
  v_closing numeric;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_closing_cash IS NULL OR p_closing_cash < 0 THEN
    RAISE EXCEPTION 'invalid_closing_cash';
  END IF;

  v_closing := ROUND(p_closing_cash::numeric, 2);

  SELECT * INTO v_row FROM public.pos_cashier_shifts WHERE id = p_shift_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'shift_not_found';
  END IF;
  IF v_row.organization_id NOT IN (SELECT public.user_organization_ids()) THEN
    RAISE EXCEPTION 'forbidden_org';
  END IF;
  IF v_row.status <> 'open' THEN
    RAISE EXCEPTION 'shift_not_open';
  END IF;

  IF v_row.opened_by IS DISTINCT FROM v_user
     AND NOT public.user_is_org_owner_or_admin(v_row.organization_id) THEN
    RAISE EXCEPTION 'not_shift_opener';
  END IF;

  v_expected := public.pos_shift_expected_cash(p_shift_id);

  UPDATE public.pos_cashier_shifts
  SET
    status = 'closed',
    closed_at = now(),
    closed_by = v_user,
    expected_cash = v_expected,
    closing_cash = v_closing,
    updated_at = now()
  WHERE id = p_shift_id
  RETURNING * INTO v_row;

  PERFORM public.enqueue_pos_shift_recap_email(p_shift_id, 'id');

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.pos_end_shift(uuid, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pos_end_shift(uuid, numeric) TO authenticated;

-- ---------------------------------------------------------------------------
-- Upsert operational settings (add shift_recap_email_enabled)
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.upsert_operational_email_notification_settings(uuid, boolean, boolean, boolean, boolean);

CREATE OR REPLACE FUNCTION public.upsert_operational_email_notification_settings(
  p_organization_id uuid,
  p_daily_sales_summary_enabled boolean,
  p_inventory_alerts_enabled boolean,
  p_promo_update_enabled boolean,
  p_daily_gross_profit_enabled boolean DEFAULT true,
  p_shift_recap_email_enabled boolean DEFAULT true
)
RETURNS public.operational_email_notification_settings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_row public.operational_email_notification_settings;
BEGIN
  IF p_organization_id IS NULL THEN
    RAISE EXCEPTION 'organization_id_required';
  END IF;

  IF NOT public.user_is_org_owner_or_admin(p_organization_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  INSERT INTO public.operational_email_notification_settings (
    organization_id,
    daily_sales_summary_enabled,
    inventory_alerts_enabled,
    promo_update_enabled,
    daily_gross_profit_enabled,
    shift_recap_email_enabled
  )
  VALUES (
    p_organization_id,
    COALESCE(p_daily_sales_summary_enabled, true),
    COALESCE(p_inventory_alerts_enabled, true),
    COALESCE(p_promo_update_enabled, true),
    COALESCE(p_daily_gross_profit_enabled, true),
    COALESCE(p_shift_recap_email_enabled, true)
  )
  ON CONFLICT (organization_id) DO UPDATE SET
    daily_sales_summary_enabled = EXCLUDED.daily_sales_summary_enabled,
    inventory_alerts_enabled = EXCLUDED.inventory_alerts_enabled,
    promo_update_enabled = EXCLUDED.promo_update_enabled,
    daily_gross_profit_enabled = EXCLUDED.daily_gross_profit_enabled,
    shift_recap_email_enabled = EXCLUDED.shift_recap_email_enabled,
    updated_at = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$fn$;

REVOKE ALL ON FUNCTION public.upsert_operational_email_notification_settings(uuid, boolean, boolean, boolean, boolean, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_operational_email_notification_settings(uuid, boolean, boolean, boolean, boolean, boolean) TO authenticated;
