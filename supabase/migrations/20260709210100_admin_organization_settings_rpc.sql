-- CMS admin: toggle subscription_self_service_enabled per organization + audit trail.

CREATE OR REPLACE FUNCTION public.admin_update_organization_settings(
  p_organization_id uuid,
  p_subscription_self_service_enabled boolean,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org public.organizations%ROWTYPE;
  v_before jsonb;
  v_after jsonb;
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

  IF p_subscription_self_service_enabled IS NULL THEN
    RAISE EXCEPTION 'subscription_self_service_enabled required' USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO v_org
  FROM public.organizations
  WHERE id = p_organization_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'organization not found' USING ERRCODE = 'P0002';
  END IF;

  v_before := jsonb_build_object(
    'subscription_self_service_enabled', v_org.subscription_self_service_enabled
  );

  v_after := jsonb_build_object(
    'subscription_self_service_enabled', p_subscription_self_service_enabled
  );

  UPDATE public.organizations
  SET subscription_self_service_enabled = p_subscription_self_service_enabled
  WHERE id = p_organization_id;

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
    v_before,
    v_after
  );

  RETURN jsonb_build_object(
    'organization_id', p_organization_id,
    'subscription_self_service_enabled', p_subscription_self_service_enabled,
    'before_state', v_before,
    'after_state', v_after
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.admin_update_organization_settings(uuid, boolean, text) TO authenticated;

COMMENT ON FUNCTION public.admin_update_organization_settings(uuid, boolean, text) IS
  'CMS admin: toggle organizations.subscription_self_service_enabled with audit log.';

-- Extend admin_list_organizations to return subscription_self_service_enabled.
-- Must drop first: PostgreSQL cannot change OUT parameter row type via CREATE OR REPLACE.

DROP FUNCTION IF EXISTS public.admin_list_organizations(text, text, integer, integer);

CREATE OR REPLACE FUNCTION public.admin_list_organizations(
  p_status_filter text DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_limit integer DEFAULT 100,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  organization_id uuid,
  company_name text,
  email text,
  created_at timestamptz,
  subscription_status text,
  effective_status text,
  is_active boolean,
  is_trial boolean,
  plan_name text,
  subscription_end_date timestamptz,
  trial_end_date timestamptz,
  has_active_subscription boolean,
  member_count integer,
  subscription_self_service_enabled boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  lim int;
  off int;
BEGIN
  IF NOT public.is_cms_admin() THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;

  lim := greatest(1, least(coalesce(p_limit, 100), 200));
  off := greatest(coalesce(p_offset, 0), 0);

  RETURN QUERY
  WITH enriched AS (
    SELECT
      o.id AS organization_id,
      o.company_name,
      o.email,
      o.created_at,
      o.has_active_subscription,
      o.subscription_self_service_enabled,
      os.status AS subscription_status,
      coalesce(os.is_trial, false) AS is_trial,
      os.subscription_end_date,
      os.trial_end_date,
      os.member_count,
      sp.name AS plan_name,
      CASE
        WHEN coalesce(os.is_trial, false) THEN os.trial_end_date
        ELSE os.subscription_end_date
      END AS v_end,
      (os.id IS NOT NULL) AS has_sub
    FROM public.organizations o
    LEFT JOIN public.organization_subscriptions os ON os.organization_id = o.id
    LEFT JOIN public.subscription_plans sp ON sp.id = os.subscription_plan_id
  ),
  computed AS (
    SELECT
      e.*,
      (e.v_end IS NOT NULL AND e.v_end < now()) AS is_expired,
      CASE
        WHEN NOT e.has_sub THEN 'none'
        WHEN e.v_end IS NOT NULL AND e.v_end < now() THEN 'expired'
        WHEN e.is_trial THEN 'trial'
        WHEN e.subscription_status = 'active' THEN 'active'
        ELSE coalesce(e.subscription_status, 'unknown')
      END AS effective_status
    FROM enriched e
  ),
  final AS (
    SELECT
      c.organization_id,
      c.company_name,
      c.email,
      c.created_at,
      c.subscription_status,
      c.effective_status,
      (
        NOT c.is_expired AND (
          (c.is_trial AND (c.trial_end_date IS NULL OR c.trial_end_date > now()))
          OR (
            NOT c.is_trial
            AND c.subscription_status = 'active'
            AND (c.subscription_end_date IS NULL OR c.subscription_end_date > now())
          )
        )
      ) AS is_active,
      c.is_trial,
      c.plan_name,
      c.subscription_end_date,
      c.trial_end_date,
      c.has_active_subscription,
      c.member_count,
      c.subscription_self_service_enabled
    FROM computed c
    WHERE (
      p_search IS NULL OR btrim(p_search) = ''
      OR c.company_name ILIKE '%' || btrim(p_search) || '%'
    )
    AND (
      p_status_filter IS NULL OR btrim(p_status_filter) = ''
      OR (
        lower(btrim(p_status_filter)) = 'active'
        AND (
          NOT c.is_expired AND (
            (c.is_trial AND (c.trial_end_date IS NULL OR c.trial_end_date > now()))
            OR (
              NOT c.is_trial
              AND c.subscription_status = 'active'
              AND (c.subscription_end_date IS NULL OR c.subscription_end_date > now())
            )
          )
        )
      )
      OR (
        lower(btrim(p_status_filter)) = 'expired'
        AND c.effective_status = 'expired'
      )
    )
  )
  SELECT
    f.organization_id,
    f.company_name,
    f.email,
    f.created_at,
    f.subscription_status,
    f.effective_status,
    f.is_active,
    f.is_trial,
    f.plan_name,
    f.subscription_end_date,
    f.trial_end_date,
    f.has_active_subscription,
    f.member_count,
    f.subscription_self_service_enabled
  FROM final f
  ORDER BY f.created_at DESC
  LIMIT lim
  OFFSET off;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.admin_list_organizations(text, text, integer, integer) TO authenticated;
