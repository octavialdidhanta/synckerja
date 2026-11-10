-- Sales outlet quota is the number of branches that may operate.
-- A signed contract closes the branches that were not chosen. Rows are not deleted.
-- Mandiri keeps 1 included outlet plus pos_paid_outlet_count. Existing rows are not rewritten.

ALTER TABLE public.organization_subscriptions
  ADD COLUMN IF NOT EXISTS sales_outlet_quota integer;

ALTER TABLE public.organization_subscriptions
  DROP CONSTRAINT IF EXISTS organization_subscriptions_sales_outlet_quota_range;

ALTER TABLE public.organization_subscriptions
  ADD CONSTRAINT organization_subscriptions_sales_outlet_quota_range
  CHECK (sales_outlet_quota IS NULL OR (sales_outlet_quota >= 0 AND sales_outlet_quota <= 100));

COMMENT ON COLUMN public.organization_subscriptions.sales_outlet_quota IS
  'Total operating outlets for a sales tenant after a signed contract. NULL until that contract is applied.';

ALTER TABLE public.cms_sales_contract_pending
  ADD COLUMN IF NOT EXISTS outlet_quota integer,
  ADD COLUMN IF NOT EXISTS keep_outlet_ids uuid[] NOT NULL DEFAULT '{}';

ALTER TABLE public.cms_sales_contract_pending
  DROP CONSTRAINT IF EXISTS cms_sales_contract_pending_outlet_quota_range;

ALTER TABLE public.cms_sales_contract_pending
  ADD CONSTRAINT cms_sales_contract_pending_outlet_quota_range
  CHECK (outlet_quota IS NULL OR (outlet_quota >= 0 AND outlet_quota <= 100));

CREATE OR REPLACE FUNCTION public.outlet_operating_cap(p_organization_id uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_self_service boolean;
  v_trial boolean := false;
  v_paid integer := 0;
  v_sales_quota integer;
  v_pos boolean := false;
BEGIN
  SELECT coalesce(o.subscription_self_service_enabled, true)
  INTO v_self_service
  FROM public.organizations o
  WHERE o.id = p_organization_id;

  IF NOT FOUND THEN
    RETURN 1;
  END IF;

  SELECT
    coalesce(os.is_trial, false),
    coalesce(os.pos_paid_outlet_count, 0),
    os.sales_outlet_quota
  INTO v_trial, v_paid, v_sales_quota
  FROM public.organization_subscriptions os
  WHERE os.organization_id = p_organization_id;

  IF NOT FOUND THEN
    RETURN 1;
  END IF;

  IF v_self_service IS DISTINCT FROM false OR v_sales_quota IS NULL THEN
    IF v_trial THEN
      RETURN 1;
    END IF;
    RETURN 1 + GREATEST(v_paid, 0);
  END IF;

  SELECT coalesce(m.is_enabled, false)
  INTO v_pos
  FROM public.organization_sales_module_access m
  WHERE m.organization_id = p_organization_id
    AND m.module_key = 'pos';

  IF NOT coalesce(v_pos, false) THEN
    RETURN 0;
  END IF;

  RETURN GREATEST(v_sales_quota, 0);
END;
$function$;

REVOKE ALL ON FUNCTION public.outlet_operating_cap(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.outlet_operating_cap(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.enforce_pos_outlet_quota()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_cap integer;
  v_locked boolean := false;
  v_existing integer := 0;
  v_active integer := 0;
BEGIN
  SELECT
    coalesce(o.subscription_self_service_enabled, true) IS FALSE
    AND os.sales_outlet_quota IS NOT NULL
  INTO v_locked
  FROM public.organizations o
  JOIN public.organization_subscriptions os ON os.organization_id = o.id
  WHERE o.id = NEW.organization_id;

  v_locked := coalesce(v_locked, false);

  IF TG_OP = 'UPDATE'
     AND v_locked
     AND NOT public.sales_contract_apply_active()
     AND NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    RAISE EXCEPTION 'outlet status waits for a signed contract' USING ERRCODE = '42501';
  END IF;

  v_cap := public.outlet_operating_cap(NEW.organization_id);

  IF coalesce(NEW.is_deleted, false) = false
     AND (TG_OP = 'INSERT' OR coalesce(OLD.is_deleted, false) = true) THEN
    SELECT count(*)::integer
    INTO v_existing
    FROM public.pos_outlets p
    WHERE p.organization_id = NEW.organization_id
      AND coalesce(p.is_deleted, false) = false
      AND p.id IS DISTINCT FROM NEW.id;

    IF v_existing >= v_cap THEN
      RAISE EXCEPTION 'outlet quota reached' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW.is_active AND coalesce(NEW.is_deleted, false) = false THEN
    IF NOT (TG_OP = 'UPDATE' AND OLD.is_active AND coalesce(OLD.is_deleted, false) = false) THEN
      SELECT count(*)::integer
      INTO v_active
      FROM public.pos_outlets p
      WHERE p.organization_id = NEW.organization_id
        AND coalesce(p.is_deleted, false) = false
        AND p.is_active
        AND p.id IS DISTINCT FROM NEW.id;

      IF v_active >= v_cap THEN
        RAISE EXCEPTION 'outlet quota reached' USING ERRCODE = '23514';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.enforce_pos_outlet_quota() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enforce_pos_outlet_quota() TO authenticated, service_role;

DROP TRIGGER IF EXISTS pos_outlets_enforce_quota ON public.pos_outlets;
CREATE TRIGGER pos_outlets_enforce_quota
  BEFORE INSERT OR UPDATE ON public.pos_outlets
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_pos_outlet_quota();

CREATE OR REPLACE FUNCTION public.resolve_sales_outlet_package(
  p_organization_id uuid,
  p_pos_enabled boolean,
  p_outlet_quota integer,
  p_keep_outlet_ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_ids uuid[];
  v_count integer := 0;
  v_keep uuid[] := ARRAY[]::uuid[];
  v_keep_count integer := 0;
BEGIN
  IF NOT coalesce(p_pos_enabled, false) THEN
    RETURN jsonb_build_object('outlet_quota', 0, 'keep_outlet_ids', '[]'::jsonb);
  END IF;

  IF p_outlet_quota IS NULL OR p_outlet_quota < 1 OR p_outlet_quota > 100 THEN
    RAISE EXCEPTION 'outlet quota must be between 1 and 100' USING ERRCODE = '22023';
  END IF;

  SELECT coalesce(array_agg(o.id), ARRAY[]::uuid[])
  INTO v_ids
  FROM public.pos_outlets o
  WHERE o.organization_id = p_organization_id
    AND coalesce(o.is_deleted, false) = false;

  v_count := coalesce(cardinality(v_ids), 0);

  IF v_count > p_outlet_quota THEN
    SELECT count(DISTINCT k.id)::integer, coalesce(array_agg(DISTINCT k.id), ARRAY[]::uuid[])
    INTO v_keep_count, v_keep
    FROM unnest(coalesce(p_keep_outlet_ids, ARRAY[]::uuid[])) AS k(id);

    IF v_keep_count IS DISTINCT FROM p_outlet_quota
       OR EXISTS (
         SELECT 1
         FROM unnest(coalesce(p_keep_outlet_ids, ARRAY[]::uuid[])) AS k(id)
         WHERE NOT (k.id = ANY (v_ids))
       ) THEN
      RAISE EXCEPTION 'pilih tepat % outlet yang tetap buka', p_outlet_quota USING ERRCODE = '22023';
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'outlet_quota', p_outlet_quota,
    'keep_outlet_ids', to_jsonb(v_keep)
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.resolve_sales_outlet_package(uuid, boolean, integer, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_sales_outlet_package(uuid, boolean, integer, uuid[]) TO service_role;

CREATE OR REPLACE FUNCTION public.apply_sales_outlet_quota(
  p_organization_id uuid,
  p_pos_enabled boolean,
  p_outlet_quota integer,
  p_keep_outlet_ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_resolved jsonb;
  v_quota integer;
  v_keep uuid[] := ARRAY[]::uuid[];
  v_id uuid;
  v_default uuid;
  v_closed jsonb := '[]'::jsonb;
BEGIN
  IF NOT public.sales_contract_apply_active() THEN
    RAISE EXCEPTION 'outlet changes wait for a signed contract' USING ERRCODE = '42501';
  END IF;

  IF NOT public.is_cms_admin() THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;

  v_resolved := public.resolve_sales_outlet_package(
    p_organization_id,
    p_pos_enabled,
    p_outlet_quota,
    p_keep_outlet_ids
  );
  v_quota := (v_resolved->>'outlet_quota')::integer;

  SELECT coalesce(array_agg(value::uuid), ARRAY[]::uuid[])
  INTO v_keep
  FROM jsonb_array_elements_text(v_resolved->'keep_outlet_ids') AS value;

  UPDATE public.organization_subscriptions os
  SET
    sales_outlet_quota = v_quota,
    pos_addon_active = coalesce(p_pos_enabled, false)
  WHERE os.organization_id = p_organization_id;

  IF NOT coalesce(p_pos_enabled, false) OR v_quota = 0 OR coalesce(cardinality(v_keep), 0) > 0 THEN
    UPDATE public.pos_outlets o
    SET
      is_active = false,
      is_default = false
    WHERE o.organization_id = p_organization_id
      AND coalesce(o.is_deleted, false) = false
      AND (
        NOT coalesce(p_pos_enabled, false)
        OR v_quota = 0
        OR NOT (o.id = ANY (v_keep))
      )
      AND (o.is_active OR o.is_default);
  END IF;

  IF coalesce(p_pos_enabled, false) AND v_quota > 0 AND coalesce(cardinality(v_keep), 0) = 0 THEN
    FOR v_id IN
      SELECT o.id
      FROM public.pos_outlets o
      WHERE o.organization_id = p_organization_id
        AND coalesce(o.is_deleted, false) = false
        AND NOT o.is_active
      ORDER BY o.sort_order, o.name
    LOOP
      UPDATE public.pos_outlets o
      SET is_active = true
      WHERE o.id = v_id
        AND NOT o.is_active;
    END LOOP;
  ELSIF coalesce(cardinality(v_keep), 0) > 0 THEN
    FOREACH v_id IN ARRAY v_keep
    LOOP
      UPDATE public.pos_outlets o
      SET is_active = true
      WHERE o.id = v_id
        AND o.organization_id = p_organization_id
        AND NOT o.is_active;
    END LOOP;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.pos_outlets o
    WHERE o.organization_id = p_organization_id
      AND coalesce(o.is_deleted, false) = false
      AND o.is_active
      AND o.is_default
  ) THEN
    SELECT o.id
    INTO v_default
    FROM public.pos_outlets o
    WHERE o.organization_id = p_organization_id
      AND coalesce(o.is_deleted, false) = false
      AND o.is_active
    ORDER BY o.sort_order, o.name
    LIMIT 1;

    IF v_default IS NOT NULL THEN
      UPDATE public.pos_outlets o
      SET is_default = false
      WHERE o.organization_id = p_organization_id
        AND o.is_default
        AND o.id IS DISTINCT FROM v_default;

      UPDATE public.pos_outlets o
      SET is_default = true
      WHERE o.id = v_default;
    END IF;
  END IF;

  SELECT coalesce(jsonb_agg(
    jsonb_build_object('id', o.id, 'name', o.name)
    ORDER BY o.name
  ), '[]'::jsonb)
  INTO v_closed
  FROM public.pos_outlets o
  WHERE o.organization_id = p_organization_id
    AND coalesce(o.is_deleted, false) = false
    AND NOT o.is_active;

  RETURN v_closed;
END;
$function$;

REVOKE ALL ON FUNCTION public.apply_sales_outlet_quota(uuid, boolean, integer, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_sales_outlet_quota(uuid, boolean, integer, uuid[]) TO service_role;

DROP FUNCTION IF EXISTS public.admin_save_sales_contract_pending(
  uuid, boolean, timestamp with time zone, timestamp with time zone, jsonb, integer, integer, uuid[], text
);

CREATE OR REPLACE FUNCTION public.admin_save_sales_contract_pending(
  p_organization_id uuid,
  p_is_trial boolean,
  p_trial_end_date timestamptz,
  p_subscription_end_date timestamptz,
  p_modules jsonb,
  p_hr_seat_count integer,
  p_omnichannel_paid_seat_count integer,
  p_keep_employee_ids uuid[],
  p_outlet_quota integer,
  p_keep_outlet_ids uuid[],
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
     OR p_omnichannel_paid_seat_count IS NULL OR p_omnichannel_paid_seat_count < 0 THEN
    RAISE EXCEPTION 'seats must be >= 0' USING ERRCODE = '22023';
  END IF;

  v_active := public.count_active_employees_for_org(p_organization_id);
  IF p_hr_seat_count < v_active THEN
    RAISE EXCEPTION 'seat HR minimal %', v_active USING ERRCODE = '22023';
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
    keep_employee_ids,
    outlet_quota,
    keep_outlet_ids,
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
    COALESCE(v_keep, ARRAY[]::uuid[]),
    v_outlet_quota,
    COALESCE(v_keep_outlets, ARRAY[]::uuid[]),
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
    keep_employee_ids = EXCLUDED.keep_employee_ids,
    outlet_quota = EXCLUDED.outlet_quota,
    keep_outlet_ids = EXCLUDED.keep_outlet_ids,
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
    'keep_employee_ids', to_jsonb(v_row.keep_employee_ids),
    'outlet_quota', v_row.outlet_quota,
    'keep_outlet_ids', to_jsonb(v_row.keep_outlet_ids),
    'saved_at', v_row.saved_at
  );
END;
$function$;

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
    'keep_employee_ids', to_jsonb(v_row.keep_employee_ids),
    'outlet_quota', v_row.outlet_quota,
    'keep_outlet_ids', to_jsonb(v_row.keep_outlet_ids),
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
      'sales_outlet_quota', v_before_sub.sales_outlet_quota,
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
      'sales_outlet_quota', v_after_sub.sales_outlet_quota,
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
  v_outlet_quota integer;
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
      'active_employee_count', 0,
      'roster_eligible_employee_count', 0,
      'omnichannel_roster', '[]'::jsonb,
      'sales_outlet_quota', NULL,
      'outlets', '[]'::jsonb
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
    os.sales_outlet_quota
  INTO v_paid, v_hr, v_outlet_quota
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
    'active_employee_count', public.count_active_employees_for_org(p_organization_id),
    'roster_eligible_employee_count', public.count_roster_eligible_employees(p_organization_id),
    'omnichannel_roster', v_roster,
    'sales_outlet_quota', v_outlet_quota,
    'outlets', v_outlets
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_save_sales_contract_pending(
  uuid, boolean, timestamp with time zone, timestamp with time zone, jsonb, integer, integer, uuid[], integer, uuid[], text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_save_sales_contract_pending(
  uuid, boolean, timestamp with time zone, timestamp with time zone, jsonb, integer, integer, uuid[], integer, uuid[], text
) TO authenticated, service_role;

COMMENT ON FUNCTION public.admin_save_sales_contract_pending(
  uuid, boolean, timestamp with time zone, timestamp with time zone, jsonb, integer, integer, uuid[], integer, uuid[], text
) IS
  'Replaces the waiting Sales package, including the outlet quota. Does not change live outlets.';

CREATE OR REPLACE FUNCTION public.protect_sales_outlet_quota()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.sales_outlet_quota IS NOT NULL AND NOT public.sales_contract_apply_active() THEN
      RAISE EXCEPTION 'outlet changes wait for a signed contract' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.sales_outlet_quota IS DISTINCT FROM OLD.sales_outlet_quota
     AND NOT public.sales_contract_apply_active() THEN
    RAISE EXCEPTION 'outlet changes wait for a signed contract' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.protect_sales_outlet_quota() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.protect_sales_outlet_quota() TO authenticated, service_role;

DROP TRIGGER IF EXISTS organization_subscriptions_protect_sales_outlet_quota ON public.organization_subscriptions;
CREATE TRIGGER organization_subscriptions_protect_sales_outlet_quota
  BEFORE INSERT OR UPDATE ON public.organization_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_sales_outlet_quota();

NOTIFY pgrst, 'reload schema';

