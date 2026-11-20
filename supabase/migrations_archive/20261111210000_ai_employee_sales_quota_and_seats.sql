-- Sales quota and mandiri paid seats for Karyawan AI.
-- One active AI employee (is_ai and still active) uses one seat.
-- Sales reads ai_employee_seat_count only while module aiEmployee is on.
-- Mandiri reads ai_employee_paid_seat_count. Daily generation quota is unchanged.

ALTER TABLE public.organization_subscriptions
  ADD COLUMN IF NOT EXISTS ai_employee_paid_seat_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ai_employee_seat_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.organization_subscriptions
  DROP CONSTRAINT IF EXISTS organization_subscriptions_ai_employee_paid_nonneg;
ALTER TABLE public.organization_subscriptions
  ADD CONSTRAINT organization_subscriptions_ai_employee_paid_nonneg
  CHECK (ai_employee_paid_seat_count >= 0);

ALTER TABLE public.organization_subscriptions
  DROP CONSTRAINT IF EXISTS organization_subscriptions_ai_employee_seat_nonneg;
ALTER TABLE public.organization_subscriptions
  ADD CONSTRAINT organization_subscriptions_ai_employee_seat_nonneg
  CHECK (ai_employee_seat_count >= 0);

COMMENT ON COLUMN public.organization_subscriptions.ai_employee_paid_seat_count IS
  'Kursi karyawan AI yang dibeli tenant mandiri lewat checkout.';
COMMENT ON COLUMN public.organization_subscriptions.ai_employee_seat_count IS
  'Kursi karyawan AI yang disepakati di kontrak sales. Berlaku hanya jika modul aiEmployee aktif.';

ALTER TABLE public.cms_sales_contract_pending
  ADD COLUMN IF NOT EXISTS ai_employee_seat_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.cms_sales_contract_pending
  DROP CONSTRAINT IF EXISTS cms_sales_contract_pending_ai_employee_nonneg;
ALTER TABLE public.cms_sales_contract_pending
  ADD CONSTRAINT cms_sales_contract_pending_ai_employee_nonneg
  CHECK (ai_employee_seat_count >= 0);

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS ai_employee_seats_applied boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.sales_module_catalog_keys()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT ARRAY[
    'okr',
    'humanResources',
    'aiEmployee',
    'finance',
    'digitalMarketing',
    'leadMagnet',
    'omnichannel',
    'whatsappBusiness',
    'pos',
    'operations',
    'tools',
    'requestForm',
    'customModules',
    'customerSupport'
  ]::text[];
$$;

CREATE OR REPLACE FUNCTION public._plan_module_label(p_module_key text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_module_key
    WHEN 'okr' THEN 'OKR'
    WHEN 'humanResources' THEN 'Human Resources'
    WHEN 'aiEmployee' THEN 'Karyawan AI'
    WHEN 'finance' THEN 'Finance'
    WHEN 'digitalMarketing' THEN 'Digital Marketing'
    WHEN 'omnichannel' THEN 'Operations / Omnichannel'
    WHEN 'whatsappBusiness' THEN 'WhatsApp Business API'
    WHEN 'pos' THEN 'POS'
    WHEN 'operations' THEN 'Operations'
    WHEN 'tools' THEN 'Tools'
    WHEN 'requestForm' THEN 'Request Form'
    WHEN 'customModules' THEN 'kustom'
    WHEN 'leadMagnet' THEN 'Lead Magnet'
    WHEN 'customerSupport' THEN 'Customer Support'
    ELSE p_module_key
  END;
$$;

INSERT INTO public.organization_sales_module_access (organization_id, module_key, is_enabled)
SELECT DISTINCT existing.organization_id, 'aiEmployee', false
FROM public.organization_sales_module_access AS existing
ON CONFLICT (organization_id, module_key) DO NOTHING;

INSERT INTO public.subscription_plan_module_access (subscription_plan_id, module_key, is_enabled)
SELECT DISTINCT existing.subscription_plan_id, 'aiEmployee', false
FROM public.subscription_plan_module_access AS existing
ON CONFLICT (subscription_plan_id, module_key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.count_active_ai_employees_for_org(p_org_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COUNT(*)::integer
  FROM public.employees e
  LEFT JOIN public.employee_statuses es ON es.id = e.employee_status_id
  WHERE e.organization_id = p_org_id
    AND COALESCE(e.pending_removal, false) = false
    AND COALESCE(e.is_ai, false) = true
    AND lower(trim(COALESCE(es.name, 'active'))) IN ('active', 'probation');
$$;

COMMENT ON FUNCTION public.count_active_ai_employees_for_org(uuid) IS
  'Karyawan AI yang masih aktif atau probation. Menonaktifkan melepas kursinya.';

REVOKE ALL ON FUNCTION public.count_active_ai_employees_for_org(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.count_active_ai_employees_for_org(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.ai_employee_seat_allowance(p_org_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE((
    SELECT CASE
      WHEN coalesce(o.subscription_self_service_enabled, true) = false THEN
        CASE
          WHEN EXISTS (
            SELECT 1
            FROM public.organization_sales_module_access m
            WHERE m.organization_id = o.id
              AND m.module_key = 'aiEmployee'
              AND m.is_enabled IS TRUE
          ) THEN COALESCE(os.ai_employee_seat_count, 0)
          ELSE 0
        END
      ELSE COALESCE(os.ai_employee_paid_seat_count, 0)
    END
    FROM public.organizations o
    LEFT JOIN public.organization_subscriptions os ON os.organization_id = o.id
    WHERE o.id = p_org_id
  ), 0);
$$;

COMMENT ON FUNCTION public.ai_employee_seat_allowance(uuid) IS
  'Kursi karyawan AI yang berlaku. Sales memakai kuota kontrak jika modul aktif. Mandiri memakai kursi yang sudah dibayar.';

REVOKE ALL ON FUNCTION public.ai_employee_seat_allowance(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ai_employee_seat_allowance(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.enforce_ai_employee_seat_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_now boolean;
  v_was boolean;
  v_status text;
  v_old_status text;
  v_allow integer;
  v_used integer;
  v_has_subscription boolean;
BEGIN
  SELECT lower(trim(COALESCE(es.name, 'active')))
  INTO v_status
  FROM public.employee_statuses es
  WHERE es.id = NEW.employee_status_id;

  v_status := COALESCE(v_status, 'active');
  v_now := COALESCE(NEW.is_ai, false) = true
    AND COALESCE(NEW.pending_removal, false) = false
    AND v_status IN ('active', 'probation');

  v_was := false;
  IF TG_OP = 'UPDATE' THEN
    SELECT lower(trim(COALESCE(es.name, 'active')))
    INTO v_old_status
    FROM public.employee_statuses es
    WHERE es.id = OLD.employee_status_id;
    v_old_status := COALESCE(v_old_status, 'active');
    v_was := COALESCE(OLD.is_ai, false) = true
      AND COALESCE(OLD.pending_removal, false) = false
      AND v_old_status IN ('active', 'probation')
      AND OLD.organization_id IS NOT DISTINCT FROM NEW.organization_id;
  END IF;

  IF NOT v_now OR v_was THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.organization_subscriptions os
    WHERE os.organization_id = NEW.organization_id
  )
  INTO v_has_subscription;

  IF NOT v_has_subscription THEN
    RETURN NEW;
  END IF;

  v_allow := public.ai_employee_seat_allowance(NEW.organization_id);
  v_used := public.count_active_ai_employees_for_org(NEW.organization_id);

  IF v_used + 1 > v_allow THEN
    RAISE EXCEPTION 'Kursi karyawan AI tidak cukup. Sisa kursi: %', GREATEST(v_allow - v_used, 0)
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS employees_ai_seat_limit ON public.employees;
CREATE TRIGGER employees_ai_seat_limit
  BEFORE INSERT OR UPDATE OF is_ai, employee_status_id, pending_removal, organization_id
  ON public.employees
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_ai_employee_seat_limit();

CREATE OR REPLACE FUNCTION public.apply_ai_employee_paid_seats_on_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_details jsonb;
  v_raw text;
  v_bundled integer;
  v_renewal boolean;
  v_current integer;
  v_active integer;
  v_target integer;
BEGIN
  IF NEW.status IS DISTINCT FROM 'success' OR OLD.status IS NOT DISTINCT FROM 'success' THEN
    RETURN NEW;
  END IF;
  IF COALESCE(NEW.ai_employee_seats_applied, false) THEN
    RETURN NEW;
  END IF;

  v_details := COALESCE(NEW.prorate_details, '{}'::jsonb);
  IF NOT (v_details ? 'bundled_ai_employee_units') THEN
    RETURN NEW;
  END IF;

  v_raw := v_details->>'bundled_ai_employee_units';
  v_bundled := CASE WHEN v_raw ~ '^[0-9]+$' THEN v_raw::integer ELSE 0 END;
  v_bundled := LEAST(50, GREATEST(0, v_bundled));
  v_renewal := COALESCE(v_details->>'renewal_full_period', '') IN ('true', '1');

  SELECT COALESCE(os.ai_employee_paid_seat_count, 0)
  INTO v_current
  FROM public.organization_subscriptions os
  WHERE os.organization_id = NEW.organization_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  v_active := public.count_active_ai_employees_for_org(NEW.organization_id);
  IF v_renewal THEN
    v_target := GREATEST(v_bundled, v_active);
  ELSE
    v_target := GREATEST(v_current, v_bundled, v_active);
  END IF;

  UPDATE public.organization_subscriptions
  SET
    ai_employee_paid_seat_count = v_target,
    last_payment_id = NEW.id,
    updated_at = now()
  WHERE organization_id = NEW.organization_id;

  NEW.ai_employee_seats_applied := true;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS payments_apply_ai_employee_seats ON public.payments;
CREATE TRIGGER payments_apply_ai_employee_seats
  BEFORE UPDATE OF status ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_ai_employee_paid_seats_on_payment();

CREATE OR REPLACE FUNCTION public.admin_set_organization_ai_employee_seats(
  p_organization_id uuid,
  p_seats integer,
  p_reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_org public.organizations%ROWTYPE;
  v_active integer;
BEGIN
  IF NOT public.is_cms_admin() THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;
  IF p_reason IS NULL OR char_length(trim(p_reason)) < 3 THEN
    RAISE EXCEPTION 'reason required (min 3 characters)' USING ERRCODE = '22023';
  END IF;
  IF p_seats IS NULL OR p_seats < 0 THEN
    RAISE EXCEPTION 'seats must be >= 0' USING ERRCODE = '22023';
  END IF;
  IF NOT public.sales_contract_apply_active() THEN
    RAISE EXCEPTION 'sales changes wait for a signed contract' USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO v_org
  FROM public.organizations
  WHERE id = p_organization_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'organization not found' USING ERRCODE = 'P0002';
  END IF;
  IF coalesce(v_org.subscription_self_service_enabled, true) THEN
    RAISE EXCEPTION 'organization is not a sales tenant' USING ERRCODE = '22023';
  END IF;

  PERFORM 1
  FROM public.organization_subscriptions os
  WHERE os.organization_id = p_organization_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'organization subscription not found' USING ERRCODE = 'P0002';
  END IF;

  v_active := public.count_active_ai_employees_for_org(p_organization_id);
  IF p_seats < v_active THEN
    RAISE EXCEPTION 'kuota karyawan AI minimal %', v_active USING ERRCODE = '22023';
  END IF;

  UPDATE public.organization_subscriptions
  SET ai_employee_seat_count = p_seats
  WHERE organization_id = p_organization_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_organization_ai_employee_seats(uuid, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_organization_ai_employee_seats(uuid, integer, text) TO authenticated, service_role;


DROP FUNCTION IF EXISTS public.admin_save_sales_contract_pending(
  uuid, boolean, timestamp with time zone, timestamp with time zone, jsonb, integer, integer, uuid[], integer, uuid[], text
);
DROP FUNCTION IF EXISTS public.admin_save_sales_contract_pending(
  uuid, boolean, timestamp with time zone, timestamp with time zone, jsonb, integer, integer, uuid[], integer, uuid[], bigint, text, boolean, date, text
);
DROP FUNCTION IF EXISTS public.admin_save_sales_contract_pending(
  uuid, boolean, timestamp with time zone, timestamp with time zone, jsonb, integer, integer, integer, uuid[], integer, uuid[], bigint, text, boolean, date, text
);

CREATE OR REPLACE FUNCTION public.admin_save_sales_contract_pending(
  p_organization_id uuid,
  p_is_trial boolean,
  p_trial_end_date timestamptz,
  p_subscription_end_date timestamptz,
  p_modules jsonb,
  p_hr_seat_count integer,
  p_omnichannel_paid_seat_count integer,
  p_ai_employee_seat_count integer,
  p_keep_employee_ids uuid[],
  p_outlet_quota integer,
  p_keep_outlet_ids uuid[],
  p_monthly_price_idr bigint,
  p_billing_mode text,
  p_ppn_included boolean,
  p_price_effective_on date,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_self_service boolean;
  v_catalog text[];
  v_key text;
  v_val boolean;
  v_modules jsonb := '{}'::jsonb;
  v_active_end timestamptz;
  v_max_future timestamptz := now() + interval '366 days';
  v_active integer;
  v_ai_active integer;
  v_ai_seats integer;
  v_eligible integer;
  v_omni_max integer;
  v_cap integer;
  v_roster_ids uuid[];
  v_roster_count integer;
  v_keep_count integer;
  v_keep uuid[] := ARRAY[]::uuid[];
  v_outlets jsonb;
  v_outlet_quota integer;
  v_keep_outlets uuid[] := ARRAY[]::uuid[];
  v_old_monthly bigint;
  v_old_end date;
  v_price jsonb;
  v_row public.cms_sales_contract_pending%ROWTYPE;
BEGIN
  IF NOT public.is_cms_admin() THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;

  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;

  IF p_reason IS NULL OR char_length(trim(p_reason)) < 3 THEN
    RAISE EXCEPTION 'reason required (min 3 characters)' USING ERRCODE = '22023';
  END IF;

  SELECT o.subscription_self_service_enabled
  INTO v_self_service
  FROM public.organizations o
  WHERE o.id = p_organization_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'organization not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_self_service IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'sales contract pending is only for sales tenants' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.organization_subscriptions os
    WHERE os.organization_id = p_organization_id
  ) THEN
    RAISE EXCEPTION 'subscription not found for organization' USING ERRCODE = 'P0002';
  END IF;

  IF coalesce(p_is_trial, false) THEN
    IF p_trial_end_date IS NULL THEN
      RAISE EXCEPTION 'trial_end_date required when in trial mode' USING ERRCODE = '22023';
    END IF;
    v_active_end := p_trial_end_date;
  ELSE
    IF p_subscription_end_date IS NULL THEN
      RAISE EXCEPTION 'subscription_end_date required when in paid mode' USING ERRCODE = '22023';
    END IF;
    v_active_end := p_subscription_end_date;
  END IF;

  IF v_active_end > now() AND v_active_end > v_max_future THEN
    RAISE EXCEPTION 'end date cannot exceed 366 days from now' USING ERRCODE = '22023';
  END IF;

  IF p_modules IS NULL OR jsonb_typeof(p_modules) <> 'object' THEN
    RAISE EXCEPTION 'modules must be a json object' USING ERRCODE = '22023';
  END IF;

  v_catalog := public.sales_module_catalog_keys();

  IF EXISTS (
    SELECT 1
    FROM jsonb_each(p_modules) AS e(key, value)
    WHERE e.key = ANY (ARRAY['dashboard', 'subscription'])
       OR NOT (e.key = ANY (v_catalog))
       OR jsonb_typeof(e.value) <> 'boolean'
  ) THEN
    RAISE EXCEPTION 'invalid module keys in payload' USING ERRCODE = '22023';
  END IF;

  FOREACH v_key IN ARRAY v_catalog
  LOOP
    IF p_modules ? v_key THEN
      v_val := (p_modules ->> v_key)::boolean;
    ELSE
      SELECT m.is_enabled
      INTO v_val
      FROM public.organization_sales_module_access m
      WHERE m.organization_id = p_organization_id
        AND m.module_key = v_key;
      v_val := coalesce(v_val, false);
    END IF;

    v_modules := v_modules || jsonb_build_object(v_key, v_val);
  END LOOP;

  IF coalesce((v_modules->>'digitalMarketing')::boolean, false) IS NOT TRUE THEN
    v_modules := jsonb_set(v_modules, '{leadMagnet}', 'false'::jsonb, true);
  END IF;

  IF coalesce((v_modules->>'omnichannel')::boolean, false) IS NOT TRUE THEN
    v_modules := jsonb_set(v_modules, '{whatsappBusiness}', 'false'::jsonb, true);
  END IF;

  IF p_hr_seat_count IS NULL OR p_hr_seat_count < 0
     OR p_omnichannel_paid_seat_count IS NULL OR p_omnichannel_paid_seat_count < 0
     OR p_ai_employee_seat_count IS NULL OR p_ai_employee_seat_count < 0 THEN
    RAISE EXCEPTION 'seats must be >= 0' USING ERRCODE = '22023';
  END IF;

  v_active := public.count_active_employees_for_org(p_organization_id);
  IF p_hr_seat_count < v_active THEN
    RAISE EXCEPTION 'seat HR minimal %', v_active USING ERRCODE = '22023';
  END IF;

  v_ai_active := public.count_active_ai_employees_for_org(p_organization_id);
  IF coalesce((v_modules->>'aiEmployee')::boolean, false) THEN
    IF p_ai_employee_seat_count < v_ai_active THEN
      RAISE EXCEPTION 'kuota karyawan AI minimal %', v_ai_active USING ERRCODE = '22023';
    END IF;
    v_ai_seats := p_ai_employee_seat_count;
  ELSE
    IF v_ai_active > 0 THEN
      RAISE EXCEPTION 'kuota karyawan AI minimal %', v_ai_active USING ERRCODE = '22023';
    END IF;
    v_ai_seats := 0;
  END IF;

  v_eligible := public.count_roster_eligible_employees(p_organization_id);
  v_omni_max := LEAST(p_hr_seat_count, v_eligible);
  IF p_omnichannel_paid_seat_count > v_omni_max THEN
    RAISE EXCEPTION 'kuota maksimal %', v_omni_max USING ERRCODE = '22023';
  END IF;

  v_cap := LEAST(p_hr_seat_count, p_omnichannel_paid_seat_count);

  SELECT COALESCE(array_agg(s.employee_id), ARRAY[]::uuid[])
  INTO v_roster_ids
  FROM public.organization_omnichannel_staff s
  WHERE s.organization_id = p_organization_id;

  v_roster_count := COALESCE(cardinality(v_roster_ids), 0);

  IF v_roster_count > v_cap THEN
    SELECT COUNT(DISTINCT k.employee_id)
    INTO v_keep_count
    FROM unnest(COALESCE(p_keep_employee_ids, ARRAY[]::uuid[])) AS k(employee_id);

    IF v_keep_count IS DISTINCT FROM v_cap
      OR EXISTS (
        SELECT 1
        FROM unnest(COALESCE(p_keep_employee_ids, ARRAY[]::uuid[])) AS k(employee_id)
        WHERE NOT (k.employee_id = ANY(v_roster_ids))
      ) THEN
      RAISE EXCEPTION 'pilih tepat % user yang tetap aktif', v_cap USING ERRCODE = '22023';
    END IF;

    SELECT COALESCE(array_agg(DISTINCT k.employee_id), ARRAY[]::uuid[])
    INTO v_keep
    FROM unnest(COALESCE(p_keep_employee_ids, ARRAY[]::uuid[])) AS k(employee_id);
  END IF;

  v_outlets := public.resolve_sales_outlet_package(
    p_organization_id,
    coalesce((v_modules->>'pos')::boolean, false),
    p_outlet_quota,
    p_keep_outlet_ids
  );
  v_outlet_quota := (v_outlets->>'outlet_quota')::integer;
  SELECT coalesce(array_agg(value::uuid), ARRAY[]::uuid[])
  INTO v_keep_outlets
  FROM jsonb_array_elements_text(v_outlets->'keep_outlet_ids') AS value;

  SELECT
    os.sales_monthly_price_idr,
    (os.subscription_end_date AT TIME ZONE 'Asia/Jakarta')::date
  INTO v_old_monthly, v_old_end
  FROM public.organization_subscriptions os
  WHERE os.organization_id = p_organization_id;

  v_price := public.sales_contract_prepare_price(
    coalesce(p_is_trial, false),
    p_monthly_price_idr,
    p_billing_mode,
    p_ppn_included,
    p_price_effective_on,
    p_subscription_end_date,
    v_old_monthly,
    v_old_end
  );

  INSERT INTO public.cms_sales_contract_pending (
    organization_id,
    saved_by,
    reason,
    is_trial,
    trial_end_date,
    subscription_end_date,
    modules,
    hr_seat_count,
    omnichannel_paid_seat_count,
    ai_employee_seat_count,
    keep_employee_ids,
    outlet_quota,
    keep_outlet_ids,
    monthly_price_idr,
    billing_mode,
    ppn_included,
    price_effective_on,
    period_value_idr,
    adjustment_idr,
    saved_at
  ) VALUES (
    p_organization_id,
    auth.uid(),
    trim(p_reason),
    coalesce(p_is_trial, false),
    p_trial_end_date,
    p_subscription_end_date,
    v_modules,
    p_hr_seat_count,
    p_omnichannel_paid_seat_count,
    v_ai_seats,
    COALESCE(v_keep, ARRAY[]::uuid[]),
    v_outlet_quota,
    COALESCE(v_keep_outlets, ARRAY[]::uuid[]),
    (v_price->>'monthly_price_idr')::bigint,
    v_price->>'billing_mode',
    (v_price->>'ppn_included')::boolean,
    (v_price->>'price_effective_on')::date,
    (v_price->>'period_value_idr')::bigint,
    (v_price->>'adjustment_idr')::bigint,
    now()
  )
  ON CONFLICT (organization_id) DO UPDATE SET
    saved_by = EXCLUDED.saved_by,
    reason = EXCLUDED.reason,
    is_trial = EXCLUDED.is_trial,
    trial_end_date = EXCLUDED.trial_end_date,
    subscription_end_date = EXCLUDED.subscription_end_date,
    modules = EXCLUDED.modules,
    hr_seat_count = EXCLUDED.hr_seat_count,
    omnichannel_paid_seat_count = EXCLUDED.omnichannel_paid_seat_count,
    ai_employee_seat_count = EXCLUDED.ai_employee_seat_count,
    keep_employee_ids = EXCLUDED.keep_employee_ids,
    outlet_quota = EXCLUDED.outlet_quota,
    keep_outlet_ids = EXCLUDED.keep_outlet_ids,
    monthly_price_idr = EXCLUDED.monthly_price_idr,
    billing_mode = EXCLUDED.billing_mode,
    ppn_included = EXCLUDED.ppn_included,
    price_effective_on = EXCLUDED.price_effective_on,
    period_value_idr = EXCLUDED.period_value_idr,
    adjustment_idr = EXCLUDED.adjustment_idr,
    saved_at = EXCLUDED.saved_at
  RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'organization_id', v_row.organization_id,
    'reason', v_row.reason,
    'is_trial', v_row.is_trial,
    'trial_end_date', v_row.trial_end_date,
    'subscription_end_date', v_row.subscription_end_date,
    'modules', v_row.modules,
    'hr_seat_count', v_row.hr_seat_count,
    'omnichannel_paid_seat_count', v_row.omnichannel_paid_seat_count,
    'ai_employee_seat_count', v_row.ai_employee_seat_count,
    'keep_employee_ids', to_jsonb(v_row.keep_employee_ids),
    'outlet_quota', v_row.outlet_quota,
    'keep_outlet_ids', to_jsonb(v_row.keep_outlet_ids),
    'monthly_price_idr', v_row.monthly_price_idr,
    'billing_mode', v_row.billing_mode,
    'ppn_included', v_row.ppn_included,
    'price_effective_on', v_row.price_effective_on,
    'period_value_idr', v_row.period_value_idr,
    'adjustment_idr', v_row.adjustment_idr,
    'saved_at', v_row.saved_at
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_save_sales_contract_pending(
  uuid, boolean, timestamp with time zone, timestamp with time zone, jsonb, integer, integer, integer, uuid[], integer, uuid[], bigint, text, boolean, date, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_save_sales_contract_pending(
  uuid, boolean, timestamp with time zone, timestamp with time zone, jsonb, integer, integer, integer, uuid[], integer, uuid[], bigint, text, boolean, date, text
) TO authenticated, service_role;

COMMENT ON FUNCTION public.admin_save_sales_contract_pending(
  uuid, boolean, timestamp with time zone, timestamp with time zone, jsonb, integer, integer, integer, uuid[], integer, uuid[], bigint, text, boolean, date, text
) IS
  'Replaces the waiting Sales package, including the package price. Does not change the live subscription.';

CREATE OR REPLACE FUNCTION public.admin_get_sales_contract_pending(
  p_organization_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_row public.cms_sales_contract_pending%ROWTYPE;
BEGIN
  IF NOT public.is_cms_admin() THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO v_row
  FROM public.cms_sales_contract_pending p
  WHERE p.organization_id = p_organization_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'organization_id', v_row.organization_id,
    'reason', v_row.reason,
    'is_trial', v_row.is_trial,
    'trial_end_date', v_row.trial_end_date,
    'subscription_end_date', v_row.subscription_end_date,
    'modules', v_row.modules,
    'hr_seat_count', v_row.hr_seat_count,
    'omnichannel_paid_seat_count', v_row.omnichannel_paid_seat_count,
    'ai_employee_seat_count', v_row.ai_employee_seat_count,
    'keep_employee_ids', to_jsonb(v_row.keep_employee_ids),
    'outlet_quota', v_row.outlet_quota,
    'keep_outlet_ids', to_jsonb(v_row.keep_outlet_ids),
    'monthly_price_idr', v_row.monthly_price_idr,
    'billing_mode', v_row.billing_mode,
    'ppn_included', v_row.ppn_included,
    'price_effective_on', v_row.price_effective_on,
    'period_value_idr', v_row.period_value_idr,
    'adjustment_idr', v_row.adjustment_idr,
    'saved_at', v_row.saved_at
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_apply_sales_signed_contract(
  p_organization_id uuid,
  p_contract_path text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_self_service boolean;
  v_pending public.cms_sales_contract_pending%ROWTYPE;
  v_contract_path text;
  v_meta jsonb;
  v_size bigint := 0;
  v_before_sub public.organization_subscriptions%ROWTYPE;
  v_after_sub public.organization_subscriptions%ROWTYPE;
  v_before_modules jsonb := '{}'::jsonb;
  v_after_modules jsonb := '{}'::jsonb;
  v_hr jsonb;
  v_removed jsonb := '[]'::jsonb;
  v_closed jsonb := '[]'::jsonb;
  v_effective_status text;
  v_end timestamptz;
  v_pos boolean := false;
  v_quote jsonb;
BEGIN
  IF NOT public.is_cms_admin() THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;

  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT o.subscription_self_service_enabled
  INTO v_self_service
  FROM public.organizations o
  WHERE o.id = p_organization_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'organization not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_self_service IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'sales contract pending is only for sales tenants' USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO v_pending
  FROM public.cms_sales_contract_pending p
  WHERE p.organization_id = p_organization_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'no pending sales contract' USING ERRCODE = 'P0002';
  END IF;

  v_contract_path := nullif(btrim(coalesce(p_contract_path, '')), '');

  IF v_contract_path IS NULL
     OR v_contract_path !~ (
       '^' || p_organization_id::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$'
     )
  THEN
    RAISE EXCEPTION 'contract pdf required' USING ERRCODE = '22023';
  END IF;

  SELECT o.metadata
  INTO v_meta
  FROM storage.objects o
  WHERE o.bucket_id = 'sales-subscription-contracts'
    AND o.name = v_contract_path
    AND (o.owner = auth.uid() OR o.owner_id = auth.uid()::text);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'contract file not found' USING ERRCODE = 'P0002';
  END IF;

  IF coalesce(v_meta->>'mimetype', '') <> 'application/pdf' THEN
    RAISE EXCEPTION 'contract must be a pdf' USING ERRCODE = '22023';
  END IF;

  BEGIN
    v_size := COALESCE((v_meta->>'size')::bigint, (v_meta->>'contentLength')::bigint, 0);
  EXCEPTION
    WHEN invalid_text_representation THEN
      v_size := 0;
  END;

  IF v_size <= 0 OR v_size > 10485760 THEN
    RAISE EXCEPTION 'contract file is too large' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.cms_subscription_adjustments a
    WHERE a.contract_path = v_contract_path
  ) THEN
    RAISE EXCEPTION 'contract file already used' USING ERRCODE = '23505';
  END IF;

  SELECT *
  INTO v_before_sub
  FROM public.organization_subscriptions os
  WHERE os.organization_id = p_organization_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'subscription not found for organization' USING ERRCODE = 'P0002';
  END IF;

  IF v_pending.is_trial THEN
    IF v_pending.monthly_price_idr IS NOT NULL
       OR v_pending.billing_mode IS NOT NULL
       OR v_pending.ppn_included IS NOT NULL
       OR v_pending.price_effective_on IS NOT NULL
       OR v_pending.period_value_idr IS NOT NULL
       OR v_pending.adjustment_idr IS NOT NULL THEN
      RAISE EXCEPTION 'trial contract has no package price' USING ERRCODE = '22023';
    END IF;
  ELSE
    IF v_pending.monthly_price_idr IS NULL
       OR v_pending.billing_mode IS NULL
       OR v_pending.ppn_included IS NULL
       OR v_pending.price_effective_on IS NULL
       OR v_pending.period_value_idr IS NULL
       OR v_pending.adjustment_idr IS NULL
       OR v_pending.subscription_end_date IS NULL THEN
      RAISE EXCEPTION 'package price required' USING ERRCODE = '22023';
    END IF;

    v_quote := public.sales_contract_price_quote(
      v_before_sub.sales_monthly_price_idr,
      v_pending.monthly_price_idr,
      (v_before_sub.subscription_end_date AT TIME ZONE 'Asia/Jakarta')::date,
      (v_pending.subscription_end_date AT TIME ZONE 'Asia/Jakarta')::date,
      v_pending.price_effective_on,
      v_pending.billing_mode
    );

    IF (v_quote->>'period_value_idr')::bigint IS DISTINCT FROM v_pending.period_value_idr
       OR (v_quote->>'adjustment_idr')::bigint IS DISTINCT FROM v_pending.adjustment_idr THEN
      RAISE EXCEPTION 'contract price is stale' USING ERRCODE = '22023';
    END IF;
  END IF;

  SELECT COALESCE(jsonb_object_agg(m.module_key, m.is_enabled), '{}'::jsonb)
  INTO v_before_modules
  FROM public.organization_sales_module_access m
  WHERE m.organization_id = p_organization_id;

  PERFORM set_config('synckerja.apply_sales_contract', '1', true);

  PERFORM public.admin_update_organization_subscription(
    p_organization_id,
    v_pending.is_trial,
    v_pending.trial_end_date,
    v_pending.subscription_end_date,
    v_pending.reason,
    NULL
  );

  PERFORM public.admin_update_organization_sales_modules(
    p_organization_id,
    v_pending.modules,
    v_pending.reason
  );

  v_hr := public.admin_set_organization_hr_seats(
    p_organization_id,
    v_pending.hr_seat_count,
    v_pending.reason,
    v_pending.keep_employee_ids,
    v_pending.omnichannel_paid_seat_count
  );

  PERFORM public.admin_set_organization_ai_employee_seats(
    p_organization_id,
    CASE
      WHEN coalesce((v_pending.modules->>'aiEmployee')::boolean, false)
        THEN v_pending.ai_employee_seat_count
      ELSE 0
    END,
    v_pending.reason
  );

  v_removed := COALESCE(v_hr->'removed_roster', '[]'::jsonb);

  SELECT coalesce(m.is_enabled, false)
  INTO v_pos
  FROM public.organization_sales_module_access m
  WHERE m.organization_id = p_organization_id
    AND m.module_key = 'pos';

  v_closed := public.apply_sales_outlet_quota(
    p_organization_id,
    v_pos,
    v_pending.outlet_quota,
    v_pending.keep_outlet_ids
  );

  IF NOT v_pending.is_trial THEN
    UPDATE public.organization_subscriptions
    SET
      sales_monthly_price_idr = v_pending.monthly_price_idr,
      sales_billing_mode = v_pending.billing_mode,
      sales_ppn_included = v_pending.ppn_included,
      sales_price_effective_on = v_pending.price_effective_on
    WHERE organization_id = p_organization_id;
  END IF;

  SELECT *
  INTO v_after_sub
  FROM public.organization_subscriptions os
  WHERE os.organization_id = p_organization_id;

  SELECT COALESCE(jsonb_object_agg(m.module_key, m.is_enabled), '{}'::jsonb)
  INTO v_after_modules
  FROM public.organization_sales_module_access m
  WHERE m.organization_id = p_organization_id;

  IF v_after_sub.is_trial THEN
    v_end := v_after_sub.trial_end_date;
  ELSE
    v_end := v_after_sub.subscription_end_date;
  END IF;

  IF v_end IS NOT NULL AND v_end < now() THEN
    v_effective_status := 'expired';
  ELSIF v_after_sub.is_trial THEN
    v_effective_status := 'trial';
  ELSIF v_after_sub.status = 'active' THEN
    v_effective_status := 'active';
  ELSE
    v_effective_status := coalesce(v_after_sub.status, 'unknown');
  END IF;

  INSERT INTO public.cms_subscription_adjustments (
    organization_id,
    adjusted_by,
    reason,
    before_state,
    after_state,
    contract_path
  ) VALUES (
    p_organization_id,
    auth.uid(),
    v_pending.reason,
    jsonb_build_object(
      'is_trial', v_before_sub.is_trial,
      'status', v_before_sub.status,
      'trial_end_date', v_before_sub.trial_end_date,
      'subscription_end_date', v_before_sub.subscription_end_date,
      'member_count', v_before_sub.member_count,
      'omnichannel_paid_seat_count', v_before_sub.omnichannel_paid_seat_count,
      'ai_employee_seat_count', v_before_sub.ai_employee_seat_count,
      'sales_outlet_quota', v_before_sub.sales_outlet_quota,
      'sales_monthly_price_idr', v_before_sub.sales_monthly_price_idr,
      'sales_billing_mode', v_before_sub.sales_billing_mode,
      'sales_ppn_included', v_before_sub.sales_ppn_included,
      'sales_price_effective_on', v_before_sub.sales_price_effective_on,
      'modules', v_before_modules
    ),
    jsonb_build_object(
      'is_trial', v_after_sub.is_trial,
      'status', v_after_sub.status,
      'trial_end_date', v_after_sub.trial_end_date,
      'subscription_end_date', v_after_sub.subscription_end_date,
      'auto_renew', v_after_sub.auto_renew,
      'has_active_subscription', (
        SELECT o.has_active_subscription
        FROM public.organizations o
        WHERE o.id = p_organization_id
      ),
      'member_count', v_after_sub.member_count,
      'omnichannel_paid_seat_count', v_after_sub.omnichannel_paid_seat_count,
      'ai_employee_seat_count', v_after_sub.ai_employee_seat_count,
      'sales_outlet_quota', v_after_sub.sales_outlet_quota,
      'sales_monthly_price_idr', v_after_sub.sales_monthly_price_idr,
      'sales_billing_mode', v_after_sub.sales_billing_mode,
      'sales_ppn_included', v_after_sub.sales_ppn_included,
      'sales_price_effective_on', v_after_sub.sales_price_effective_on,
      'period_value_idr', v_pending.period_value_idr,
      'adjustment_idr', v_pending.adjustment_idr,
      'modules', v_after_modules,
      'removed_roster', v_removed,
      'closed_outlets', v_closed
    ),
    v_contract_path
  );

  DELETE FROM public.cms_sales_contract_pending
  WHERE organization_id = p_organization_id;

  RETURN jsonb_build_object(
    'organization_id', p_organization_id,
    'contract_path', v_contract_path,
    'effective_status', v_effective_status
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_get_organization_sales_modules(
  p_organization_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_is_sales boolean;
  v_modules jsonb := '{}'::jsonb;
  v_key text;
  v_enabled boolean;
  v_paid integer := 0;
  v_hr integer := 0;
  v_ai integer := 0;
  v_ai_active integer := 0;
  v_outlet_quota integer;
  v_monthly bigint;
  v_billing text;
  v_ppn boolean;
  v_effective date;
  v_roster jsonb := '[]'::jsonb;
  v_outlets jsonb := '[]'::jsonb;
BEGIN
  IF NOT public.is_cms_admin() THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;

  SELECT coalesce(o.subscription_self_service_enabled, true)
  INTO v_is_sales
  FROM public.organizations o
  WHERE o.id = p_organization_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'organization not found' USING ERRCODE = 'P0002';
  END IF;

  v_is_sales := NOT v_is_sales;

  IF NOT v_is_sales THEN
    RETURN jsonb_build_object(
      'organization_id', p_organization_id,
      'is_sales_tenant', false,
      'modules', '{}'::jsonb,
      'omnichannel_paid_seat_count', 0,
      'hr_seat_count', 0,
      'ai_employee_seat_count', 0,
      'active_employee_count', 0,
      'active_ai_employee_count', 0,
      'roster_eligible_employee_count', 0,
      'omnichannel_roster', '[]'::jsonb,
      'sales_outlet_quota', NULL,
      'outlets', '[]'::jsonb,
      'sales_monthly_price_idr', NULL,
      'sales_billing_mode', NULL,
      'sales_ppn_included', NULL,
      'sales_price_effective_on', NULL
    );
  END IF;

  FOREACH v_key IN ARRAY public.sales_module_catalog_keys()
  LOOP
    SELECT m.is_enabled
    INTO v_enabled
    FROM public.organization_sales_module_access m
    WHERE m.organization_id = p_organization_id
      AND m.module_key = v_key;

    v_modules := v_modules || jsonb_build_object(v_key, coalesce(v_enabled, false));
  END LOOP;

  SELECT
    COALESCE(os.omnichannel_paid_seat_count, 0),
    COALESCE(os.member_count, 0),
    COALESCE(os.ai_employee_seat_count, 0),
    os.sales_outlet_quota,
    os.sales_monthly_price_idr,
    os.sales_billing_mode,
    os.sales_ppn_included,
    os.sales_price_effective_on
  INTO v_paid, v_hr, v_ai, v_outlet_quota, v_monthly, v_billing, v_ppn, v_effective
  FROM public.organization_subscriptions os
  WHERE os.organization_id = p_organization_id
  LIMIT 1;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'employee_id', s.employee_id,
      'full_name', COALESCE(e.full_name, ''),
      'email', e.email,
      'role', s.role
    )
    ORDER BY e.full_name
  ), '[]'::jsonb)
  INTO v_roster
  FROM public.organization_omnichannel_staff s
  JOIN public.employees e ON e.id = s.employee_id
  WHERE s.organization_id = p_organization_id;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', o.id,
      'name', o.name,
      'is_active', o.is_active,
      'is_default', o.is_default
    )
    ORDER BY o.is_default DESC, o.sort_order, o.name
  ), '[]'::jsonb)
  INTO v_outlets
  FROM public.pos_outlets o
  WHERE o.organization_id = p_organization_id
    AND coalesce(o.is_deleted, false) = false;

  RETURN jsonb_build_object(
    'organization_id', p_organization_id,
    'is_sales_tenant', true,
    'modules', v_modules,
    'omnichannel_paid_seat_count', COALESCE(v_paid, 0),
    'hr_seat_count', COALESCE(v_hr, 0),
    'ai_employee_seat_count', COALESCE(v_ai, 0),
    'active_employee_count', public.count_active_employees_for_org(p_organization_id),
    'active_ai_employee_count', public.count_active_ai_employees_for_org(p_organization_id),
    'roster_eligible_employee_count', public.count_roster_eligible_employees(p_organization_id),
    'omnichannel_roster', v_roster,
    'sales_outlet_quota', v_outlet_quota,
    'outlets', v_outlets,
    'sales_monthly_price_idr', v_monthly,
    'sales_billing_mode', v_billing,
    'sales_ppn_included', v_ppn,
    'sales_price_effective_on', v_effective
  );
END;
$function$;


NOTIFY pgrst, 'reload schema';
