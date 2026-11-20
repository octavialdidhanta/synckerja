-- Lowering a sales-tenant omnichannel quota removes the roster rows that
-- were not explicitly kept. Employee records and logins stay.

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
  v_roster jsonb := '[]'::jsonb;
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
      'roster_eligible_employee_count', 0,
      'omnichannel_roster', '[]'::jsonb
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
    COALESCE(os.member_count, 0)
  INTO v_paid, v_hr
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

  RETURN jsonb_build_object(
    'organization_id', p_organization_id,
    'is_sales_tenant', true,
    'modules', v_modules,
    'omnichannel_paid_seat_count', COALESCE(v_paid, 0),
    'hr_seat_count', COALESCE(v_hr, 0),
    'roster_eligible_employee_count', public.count_roster_eligible_employees(p_organization_id),
    'omnichannel_roster', v_roster
  );
END;
$function$;

DROP FUNCTION IF EXISTS public.admin_set_organization_omnichannel_seats(uuid, integer, text);

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

  RETURN jsonb_build_object(
    'organization_id', p_organization_id,
    'omnichannel_paid_seat_count', p_seats,
    'hr_seat_count', v_hr,
    'roster_eligible_employee_count', v_eligible,
    'removed_roster', v_removed
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_set_organization_omnichannel_seats(uuid, integer, text, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_organization_omnichannel_seats(uuid, integer, text, uuid[]) TO authenticated;

DROP TRIGGER IF EXISTS trg_facebook_conversations_assignee_omnichannel_roster ON public.facebook_conversations;
CREATE TRIGGER trg_facebook_conversations_assignee_omnichannel_roster
  BEFORE INSERT OR UPDATE OF assignee_id, organization_id ON public.facebook_conversations
  FOR EACH ROW
  WHEN (NEW.assignee_id IS NOT NULL)
  EXECUTE FUNCTION public.enforce_assignee_on_omnichannel_roster();

DROP TRIGGER IF EXISTS trg_threads_conversations_assignee_omnichannel_roster ON public.threads_conversations;
CREATE TRIGGER trg_threads_conversations_assignee_omnichannel_roster
  BEFORE INSERT OR UPDATE OF assignee_id, organization_id ON public.threads_conversations
  FOR EACH ROW
  WHEN (NEW.assignee_id IS NOT NULL)
  EXECUTE FUNCTION public.enforce_assignee_on_omnichannel_roster();

NOTIFY pgrst, 'reload schema';
