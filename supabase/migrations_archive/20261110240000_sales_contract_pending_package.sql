-- Sales date, module, and quota edits wait in one package.
-- A signed PDF applies that package in a single transaction.
-- Mandiri subscription saves stay immediate and do not use this table.

CREATE OR REPLACE FUNCTION public.sales_contract_apply_active()
RETURNS boolean
LANGUAGE sql
VOLATILE
SET search_path TO 'public'
AS $function$
  SELECT coalesce(current_setting('synckerja.apply_sales_contract', true), '') = '1';
$function$;

COMMENT ON FUNCTION public.sales_contract_apply_active() IS
  'True only inside admin_apply_sales_signed_contract, for the current transaction.';

REVOKE ALL ON FUNCTION public.sales_contract_apply_active() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sales_contract_apply_active() FROM anon;
GRANT EXECUTE ON FUNCTION public.sales_contract_apply_active() TO authenticated, service_role;

CREATE TABLE public.cms_sales_contract_pending (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  saved_by uuid NOT NULL,
  reason text NOT NULL,
  is_trial boolean NOT NULL,
  trial_end_date timestamptz,
  subscription_end_date timestamptz,
  modules jsonb NOT NULL,
  hr_seat_count integer NOT NULL,
  omnichannel_paid_seat_count integer NOT NULL,
  keep_employee_ids uuid[] NOT NULL DEFAULT '{}',
  saved_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cms_sales_contract_pending_reason_len CHECK (char_length(btrim(reason)) >= 3),
  CONSTRAINT cms_sales_contract_pending_hr_nonneg CHECK (hr_seat_count >= 0),
  CONSTRAINT cms_sales_contract_pending_omni_nonneg CHECK (omnichannel_paid_seat_count >= 0),
  CONSTRAINT cms_sales_contract_pending_modules_object CHECK (jsonb_typeof(modules) = 'object')
);

ALTER TABLE public.cms_sales_contract_pending ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.cms_sales_contract_pending FROM PUBLIC;
REVOKE ALL ON TABLE public.cms_sales_contract_pending FROM anon;
REVOKE ALL ON TABLE public.cms_sales_contract_pending FROM authenticated;

COMMENT ON TABLE public.cms_sales_contract_pending IS
  'One waiting Sales package per organization. Live dates, modules, and quotas stay unchanged until a signed PDF is applied.';

CREATE OR REPLACE FUNCTION public.admin_update_organization_subscription(
  p_organization_id uuid,
  p_is_trial boolean,
  p_trial_end_date timestamptz,
  p_subscription_end_date timestamptz,
  p_reason text,
  p_contract_path text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_sub public.organization_subscriptions%ROWTYPE;
  v_before jsonb;
  v_after jsonb;
  v_new_status text;
  v_new_is_trial boolean;
  v_new_trial_end timestamptz;
  v_new_sub_end timestamptz;
  v_effective_status text;
  v_end timestamptz;
  v_max_future timestamptz := now() + interval '366 days';
  v_active_end timestamptz;
  v_sales boolean := false;
  v_terms_changed boolean := false;
  v_applying boolean := false;
  v_contract_path text;
  v_meta jsonb;
  v_size bigint := 0;
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

  SELECT COALESCE(o.subscription_self_service_enabled, true) = false
  INTO v_sales
  FROM public.organizations o
  WHERE o.id = p_organization_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'subscription not found for organization' USING ERRCODE = 'P0002';
  END IF;

  v_applying := public.sales_contract_apply_active();

  IF COALESCE(v_sales, false) AND NOT v_applying THEN
    RAISE EXCEPTION 'sales changes wait for a signed contract' USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO v_sub
  FROM public.organization_subscriptions
  WHERE organization_id = p_organization_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'subscription not found for organization' USING ERRCODE = 'P0002';
  END IF;

  v_new_is_trial := coalesce(p_is_trial, false);
  v_new_trial_end := p_trial_end_date;
  v_new_sub_end := p_subscription_end_date;
  v_contract_path := nullif(btrim(coalesce(p_contract_path, '')), '');

  v_terms_changed :=
    coalesce(p_is_trial, false) IS DISTINCT FROM coalesce(v_sub.is_trial, false)
    OR date_trunc('minute', p_trial_end_date) IS DISTINCT FROM date_trunc('minute', v_sub.trial_end_date)
    OR date_trunc('minute', p_subscription_end_date) IS DISTINCT FROM date_trunc('minute', v_sub.subscription_end_date);

  IF NOT v_applying THEN
    IF COALESCE(v_sales, false) AND v_terms_changed THEN
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
    ELSIF v_contract_path IS NOT NULL THEN
      RAISE EXCEPTION 'contract pdf is not allowed for this change' USING ERRCODE = '22023';
    END IF;
  END IF;

  IF v_new_is_trial THEN
    IF v_new_trial_end IS NULL THEN
      RAISE EXCEPTION 'trial_end_date required when in trial mode' USING ERRCODE = '22023';
    END IF;
    v_active_end := v_new_trial_end;
  ELSE
    IF v_new_sub_end IS NULL THEN
      RAISE EXCEPTION 'subscription_end_date required when in paid mode' USING ERRCODE = '22023';
    END IF;
    v_active_end := v_new_sub_end;
  END IF;

  IF v_active_end > now() AND v_active_end > v_max_future THEN
    RAISE EXCEPTION 'end date cannot exceed 366 days from now' USING ERRCODE = '22023';
  END IF;

  v_before := jsonb_build_object(
    'is_trial', v_sub.is_trial,
    'status', v_sub.status,
    'trial_end_date', v_sub.trial_end_date,
    'subscription_end_date', v_sub.subscription_end_date,
    'auto_renew', v_sub.auto_renew
  );

  IF v_new_is_trial THEN
    IF v_new_trial_end > now() THEN
      v_new_status := 'trial';
    ELSE
      v_new_status := 'expired';
      v_new_is_trial := false;
    END IF;
  ELSE
    v_new_is_trial := false;
    IF v_new_sub_end > now() THEN
      v_new_status := 'active';
    ELSE
      v_new_status := 'expired';
    END IF;
  END IF;

  UPDATE public.organization_subscriptions
  SET
    is_trial = v_new_is_trial,
    status = v_new_status,
    trial_end_date = v_new_trial_end,
    subscription_end_date = v_new_sub_end,
    auto_renew = CASE
      WHEN NOT v_new_is_trial AND v_new_status = 'active' THEN true
      WHEN v_new_status = 'expired' THEN false
      ELSE auto_renew
    END,
    updated_at = now()
  WHERE organization_id = p_organization_id
  RETURNING * INTO v_sub;

  v_after := jsonb_build_object(
    'is_trial', v_sub.is_trial,
    'status', v_sub.status,
    'trial_end_date', v_sub.trial_end_date,
    'subscription_end_date', v_sub.subscription_end_date,
    'auto_renew', v_sub.auto_renew,
    'has_active_subscription', (
      SELECT o.has_active_subscription
      FROM public.organizations o
      WHERE o.id = p_organization_id
    )
  );

  IF v_sub.is_trial THEN
    v_end := v_sub.trial_end_date;
  ELSE
    v_end := v_sub.subscription_end_date;
  END IF;

  IF v_end IS NOT NULL AND v_end < now() THEN
    v_effective_status := 'expired';
  ELSIF v_sub.is_trial THEN
    v_effective_status := 'trial';
  ELSIF v_sub.status = 'active' THEN
    v_effective_status := 'active';
  ELSE
    v_effective_status := coalesce(v_sub.status, 'unknown');
  END IF;

  IF NOT v_applying THEN
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
      trim(p_reason),
      v_before,
      v_after,
      v_contract_path
    );
  END IF;

  RETURN jsonb_build_object(
    'organization_id', p_organization_id,
    'effective_status', v_effective_status,
    'is_trial', v_sub.is_trial,
    'trial_end_date', v_sub.trial_end_date,
    'subscription_end_date', v_sub.subscription_end_date,
    'has_active_subscription', v_after->'has_active_subscription',
    'after_state', v_after,
    'contract_path', CASE WHEN v_applying THEN NULL ELSE v_contract_path END
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_update_organization_sales_modules(
  p_organization_id uuid,
  p_modules jsonb,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org public.organizations%ROWTYPE;
  v_before jsonb := '{}'::jsonb;
  v_after jsonb := '{}'::jsonb;
  v_key text;
  v_val boolean;
  v_catalog text[];
  v_applying boolean := false;
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

  IF p_modules IS NULL OR jsonb_typeof(p_modules) <> 'object' THEN
    RAISE EXCEPTION 'modules must be a json object' USING ERRCODE = '22023';
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

  v_applying := public.sales_contract_apply_active();

  IF NOT v_applying THEN
    RAISE EXCEPTION 'sales changes wait for a signed contract' USING ERRCODE = '42501';
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

  PERFORM public.seed_sales_module_access_defaults(p_organization_id);

  FOREACH v_key IN ARRAY v_catalog
  LOOP
    SELECT m.is_enabled
    INTO v_val
    FROM public.organization_sales_module_access m
    WHERE m.organization_id = p_organization_id
      AND m.module_key = v_key;

    v_before := v_before || jsonb_build_object(v_key, coalesce(v_val, false));
  END LOOP;

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

    INSERT INTO public.organization_sales_module_access (
      organization_id,
      module_key,
      is_enabled,
      updated_at
    ) VALUES (
      p_organization_id,
      v_key,
      v_val,
      now()
    )
    ON CONFLICT (organization_id, module_key)
    DO UPDATE SET
      is_enabled = EXCLUDED.is_enabled,
      updated_at = now();

    v_after := v_after || jsonb_build_object(v_key, v_val);
  END LOOP;

  IF NOT v_applying THEN
    INSERT INTO public.cms_organization_module_adjustments (
      organization_id,
      adjusted_by,
      reason,
      before_state,
      after_state
    ) VALUES (
      p_organization_id,
      auth.uid(),
      trim(p_reason),
      jsonb_build_object('modules', v_before),
      jsonb_build_object('modules', v_after)
    );
  END IF;

  RETURN jsonb_build_object(
    'organization_id', p_organization_id,
    'modules', v_after,
    'before_state', jsonb_build_object('modules', v_before),
    'after_state', jsonb_build_object('modules', v_after)
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_set_organization_hr_seats(
  p_organization_id uuid,
  p_seats integer,
  p_reason text,
  p_keep_employee_ids uuid[],
  p_omnichannel_seats integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org public.organizations%ROWTYPE;
  v_before_hr integer;
  v_before_omni integer;
  v_active integer;
  v_eligible integer;
  v_target_omni integer;
  v_omni_max integer;
  v_cap integer;
  v_roster_ids uuid[];
  v_roster_count integer;
  v_keep_count integer;
  v_remove_ids uuid[] := ARRAY[]::uuid[];
  v_removed jsonb := '[]'::jsonb;
  v_applying boolean := false;
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

  PERFORM pg_advisory_xact_lock(42, hashtext(p_organization_id::text));

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

  v_applying := public.sales_contract_apply_active();

  IF NOT v_applying THEN
    RAISE EXCEPTION 'sales changes wait for a signed contract' USING ERRCODE = '42501';
  END IF;

  SELECT
    COALESCE(os.member_count, 0),
    COALESCE(os.omnichannel_paid_seat_count, 0)
  INTO v_before_hr, v_before_omni
  FROM public.organization_subscriptions os
  WHERE os.organization_id = p_organization_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'organization subscription not found' USING ERRCODE = 'P0002';
  END IF;

  v_active := public.count_active_employees_for_org(p_organization_id);
  IF p_seats < v_active THEN
    RAISE EXCEPTION 'seat HR minimal %', v_active USING ERRCODE = '22023';
  END IF;

  v_eligible := public.count_roster_eligible_employees(p_organization_id);
  v_omni_max := LEAST(p_seats, v_eligible);

  IF p_omnichannel_seats IS NULL THEN
    v_target_omni := LEAST(v_before_omni, p_seats);
  ELSE
    IF p_omnichannel_seats < 0 THEN
      RAISE EXCEPTION 'seats must be >= 0' USING ERRCODE = '22023';
    END IF;
    IF p_omnichannel_seats > v_omni_max THEN
      RAISE EXCEPTION 'kuota maksimal %', v_omni_max USING ERRCODE = '22023';
    END IF;
    v_target_omni := p_omnichannel_seats;
  END IF;

  v_cap := LEAST(p_seats, v_target_omni);

  PERFORM 1
  FROM public.organization_omnichannel_staff s
  WHERE s.organization_id = p_organization_id
  FOR UPDATE;

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

    SELECT COALESCE(array_agg(rid), ARRAY[]::uuid[])
    INTO v_remove_ids
    FROM unnest(v_roster_ids) AS rid
    WHERE NOT (rid = ANY(COALESCE(p_keep_employee_ids, ARRAY[]::uuid[])));
  END IF;

  IF COALESCE(cardinality(v_remove_ids), 0) > 0 THEN
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'employee_id', e.id,
        'full_name', COALESCE(e.full_name, ''),
        'email', e.email
      )
      ORDER BY e.full_name
    ), '[]'::jsonb)
    INTO v_removed
    FROM public.employees e
    WHERE e.id = ANY(v_remove_ids);

    UPDATE public.whatsapp_conversations
    SET assignee_id = NULL
    WHERE organization_id = p_organization_id
      AND assignee_id = ANY(v_remove_ids);

    UPDATE public.instagram_conversations
    SET assignee_id = NULL
    WHERE organization_id = p_organization_id
      AND assignee_id = ANY(v_remove_ids);

    UPDATE public.facebook_conversations
    SET assignee_id = NULL
    WHERE organization_id = p_organization_id
      AND assignee_id = ANY(v_remove_ids);

    UPDATE public.threads_conversations
    SET assignee_id = NULL
    WHERE organization_id = p_organization_id
      AND assignee_id = ANY(v_remove_ids);

    UPDATE public.leads
    SET assignee_id = NULL
    WHERE organization_id = p_organization_id
      AND assignee_id = ANY(v_remove_ids);

    DELETE FROM public.organization_omnichannel_staff
    WHERE organization_id = p_organization_id
      AND employee_id = ANY(v_remove_ids);
  END IF;

  UPDATE public.organization_subscriptions
  SET
    member_count = p_seats,
    omnichannel_paid_seat_count = v_target_omni
  WHERE organization_id = p_organization_id;

  IF NOT v_applying THEN
    INSERT INTO public.cms_subscription_adjustments (
      organization_id,
      adjusted_by,
      reason,
      before_state,
      after_state
    ) VALUES (
      p_organization_id,
      auth.uid(),
      trim(p_reason),
      jsonb_build_object(
        'member_count', v_before_hr,
        'omnichannel_paid_seat_count', v_before_omni
      ),
      jsonb_build_object(
        'member_count', p_seats,
        'omnichannel_paid_seat_count', v_target_omni,
        'removed_roster', v_removed
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'organization_id', p_organization_id,
    'member_count', p_seats,
    'omnichannel_paid_seat_count', v_target_omni,
    'active_employee_count', v_active,
    'removed_roster', v_removed
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_set_organization_omnichannel_seats(
  p_organization_id uuid,
  p_seats integer,
  p_reason text,
  p_keep_employee_ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org public.organizations%ROWTYPE;
  v_before integer;
  v_hr integer;
  v_eligible integer;
  v_max integer;
  v_roster_ids uuid[];
  v_roster_count integer;
  v_keep_count integer;
  v_remove_ids uuid[] := ARRAY[]::uuid[];
  v_removed jsonb := '[]'::jsonb;
  v_applying boolean := false;
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

  PERFORM pg_advisory_xact_lock(42, hashtext(p_organization_id::text));

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

  v_applying := public.sales_contract_apply_active();

  IF NOT v_applying THEN
    RAISE EXCEPTION 'sales changes wait for a signed contract' USING ERRCODE = '42501';
  END IF;

  SELECT
    COALESCE(os.omnichannel_paid_seat_count, 0),
    COALESCE(os.member_count, 0)
  INTO v_before, v_hr
  FROM public.organization_subscriptions os
  WHERE os.organization_id = p_organization_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'organization subscription not found' USING ERRCODE = 'P0002';
  END IF;

  v_eligible := public.count_roster_eligible_employees(p_organization_id);
  v_max := LEAST(v_hr, v_eligible);

  IF p_seats > v_max THEN
    RAISE EXCEPTION 'kuota maksimal %', v_max USING ERRCODE = '22023';
  END IF;

  PERFORM 1
  FROM public.organization_omnichannel_staff s
  WHERE s.organization_id = p_organization_id
  FOR UPDATE;

  SELECT COALESCE(array_agg(s.employee_id), ARRAY[]::uuid[])
  INTO v_roster_ids
  FROM public.organization_omnichannel_staff s
  WHERE s.organization_id = p_organization_id;

  v_roster_count := COALESCE(cardinality(v_roster_ids), 0);

  IF v_roster_count > p_seats THEN
    SELECT COUNT(DISTINCT k.employee_id)
    INTO v_keep_count
    FROM unnest(COALESCE(p_keep_employee_ids, ARRAY[]::uuid[])) AS k(employee_id);

    IF v_keep_count IS DISTINCT FROM p_seats
      OR EXISTS (
        SELECT 1
        FROM unnest(COALESCE(p_keep_employee_ids, ARRAY[]::uuid[])) AS k(employee_id)
        WHERE NOT (k.employee_id = ANY(v_roster_ids))
      ) THEN
      RAISE EXCEPTION 'pilih tepat % user yang tetap aktif', p_seats USING ERRCODE = '22023';
    END IF;

    SELECT COALESCE(array_agg(rid), ARRAY[]::uuid[])
    INTO v_remove_ids
    FROM unnest(v_roster_ids) AS rid
    WHERE NOT (rid = ANY(COALESCE(p_keep_employee_ids, ARRAY[]::uuid[])));
  END IF;

  IF COALESCE(cardinality(v_remove_ids), 0) > 0 THEN
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'employee_id', e.id,
        'full_name', COALESCE(e.full_name, ''),
        'email', e.email
      )
      ORDER BY e.full_name
    ), '[]'::jsonb)
    INTO v_removed
    FROM public.employees e
    WHERE e.id = ANY(v_remove_ids);

    UPDATE public.whatsapp_conversations
    SET assignee_id = NULL
    WHERE organization_id = p_organization_id
      AND assignee_id = ANY(v_remove_ids);

    UPDATE public.instagram_conversations
    SET assignee_id = NULL
    WHERE organization_id = p_organization_id
      AND assignee_id = ANY(v_remove_ids);

    UPDATE public.facebook_conversations
    SET assignee_id = NULL
    WHERE organization_id = p_organization_id
      AND assignee_id = ANY(v_remove_ids);

    UPDATE public.threads_conversations
    SET assignee_id = NULL
    WHERE organization_id = p_organization_id
      AND assignee_id = ANY(v_remove_ids);

    UPDATE public.leads
    SET assignee_id = NULL
    WHERE organization_id = p_organization_id
      AND assignee_id = ANY(v_remove_ids);

    DELETE FROM public.organization_omnichannel_staff
    WHERE organization_id = p_organization_id
      AND employee_id = ANY(v_remove_ids);
  END IF;

  UPDATE public.organization_subscriptions
  SET omnichannel_paid_seat_count = p_seats
  WHERE organization_id = p_organization_id;

  IF NOT v_applying THEN
    INSERT INTO public.cms_subscription_adjustments (
      organization_id,
      adjusted_by,
      reason,
      before_state,
      after_state
    ) VALUES (
      p_organization_id,
      auth.uid(),
      trim(p_reason),
      jsonb_build_object('omnichannel_paid_seat_count', v_before),
      jsonb_build_object(
        'omnichannel_paid_seat_count', p_seats,
        'removed_roster', v_removed
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'organization_id', p_organization_id,
    'omnichannel_paid_seat_count', p_seats,
    'hr_seat_count', v_hr,
    'roster_eligible_employee_count', v_eligible,
    'removed_roster', v_removed
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_save_sales_contract_pending(
  p_organization_id uuid,
  p_is_trial boolean,
  p_trial_end_date timestamptz,
  p_subscription_end_date timestamptz,
  p_modules jsonb,
  p_hr_seat_count integer,
  p_omnichannel_paid_seat_count integer,
  p_keep_employee_ids uuid[],
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
  v_effective_status text;
  v_end timestamptz;
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
      'modules', v_after_modules,
      'removed_roster', v_removed
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

COMMENT ON FUNCTION public.admin_save_sales_contract_pending(
  uuid, boolean, timestamptz, timestamptz, jsonb, integer, integer, uuid[], text
) IS
  'Replaces the waiting Sales package. Does not change live dates, modules, quotas, or roster.';

COMMENT ON FUNCTION public.admin_get_sales_contract_pending(uuid) IS
  'Returns the waiting Sales package, or null when none is saved.';

COMMENT ON FUNCTION public.admin_apply_sales_signed_contract(uuid, text) IS
  'Applies the waiting Sales package after a signed PDF is stored, then deletes that package.';

REVOKE ALL ON FUNCTION public.admin_save_sales_contract_pending(
  uuid, boolean, timestamptz, timestamptz, jsonb, integer, integer, uuid[], text
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_save_sales_contract_pending(
  uuid, boolean, timestamptz, timestamptz, jsonb, integer, integer, uuid[], text
) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_save_sales_contract_pending(
  uuid, boolean, timestamptz, timestamptz, jsonb, integer, integer, uuid[], text
) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.admin_get_sales_contract_pending(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_get_sales_contract_pending(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_get_sales_contract_pending(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.admin_apply_sales_signed_contract(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_apply_sales_signed_contract(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_apply_sales_signed_contract(uuid, text) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
