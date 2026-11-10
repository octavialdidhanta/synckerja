-- Sales subscription saves that change the term must attach one private PDF.
-- Mandiri saves, and sales saves that do not change the term, stay without a file.
-- Existing adjustment rows keep a null contract_path.

ALTER TABLE public.cms_subscription_adjustments
  ADD COLUMN IF NOT EXISTS contract_path text;

COMMENT ON COLUMN public.cms_subscription_adjustments.contract_path IS
  'Private sales-subscription-contracts object path. Null for older rows and non-contract saves.';

CREATE UNIQUE INDEX IF NOT EXISTS cms_subscription_adjustments_contract_path_uidx
  ON public.cms_subscription_adjustments (contract_path)
  WHERE contract_path IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'cms_subscription_adjustments_contract_path_format'
      AND conrelid = 'public.cms_subscription_adjustments'::regclass
  ) THEN
    ALTER TABLE public.cms_subscription_adjustments
      ADD CONSTRAINT cms_subscription_adjustments_contract_path_format
      CHECK (
        contract_path IS NULL
        OR contract_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$'
      );
  END IF;
END $$;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'sales-subscription-contracts',
  'sales-subscription-contracts',
  false,
  10485760,
  ARRAY['application/pdf']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE OR REPLACE FUNCTION public.cms_sales_contract_path_allowed(p_name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid;
BEGIN
  IF NOT public.is_cms_admin() THEN
    RETURN false;
  END IF;
  IF p_name IS NULL
     OR p_name !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$'
  THEN
    RETURN false;
  END IF;
  v_org := split_part(p_name, '/', 1)::uuid;
  RETURN EXISTS (
    SELECT 1 FROM public.organizations o WHERE o.id = v_org
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.cms_sales_contract_is_recorded(p_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT public.is_cms_admin()
    AND EXISTS (
      SELECT 1
      FROM public.cms_subscription_adjustments a
      WHERE a.contract_path = p_name
    );
$function$;

REVOKE ALL ON FUNCTION public.cms_sales_contract_path_allowed(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cms_sales_contract_path_allowed(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.cms_sales_contract_path_allowed(text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.cms_sales_contract_is_recorded(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cms_sales_contract_is_recorded(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.cms_sales_contract_is_recorded(text) TO authenticated, service_role;

DROP POLICY IF EXISTS "sales_subscription_contracts_select" ON storage.objects;
CREATE POLICY "sales_subscription_contracts_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'sales-subscription-contracts'
    AND public.is_cms_admin()
  );

DROP POLICY IF EXISTS "sales_subscription_contracts_insert" ON storage.objects;
CREATE POLICY "sales_subscription_contracts_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'sales-subscription-contracts'
    AND public.cms_sales_contract_path_allowed(name)
  );

DROP POLICY IF EXISTS "sales_subscription_contracts_delete" ON storage.objects;
CREATE POLICY "sales_subscription_contracts_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'sales-subscription-contracts'
    AND public.is_cms_admin()
    AND NOT public.cms_sales_contract_is_recorded(name)
  );

DROP FUNCTION IF EXISTS public.admin_update_organization_subscription(
  uuid, boolean, timestamptz, timestamptz, text
);

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

  SELECT *
  INTO v_sub
  FROM public.organization_subscriptions
  WHERE organization_id = p_organization_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'subscription not found for organization' USING ERRCODE = 'P0002';
  END IF;

  SELECT COALESCE(o.subscription_self_service_enabled, true) = false
  INTO v_sales
  FROM public.organizations o
  WHERE o.id = p_organization_id;

  v_new_is_trial := coalesce(p_is_trial, false);
  v_new_trial_end := p_trial_end_date;
  v_new_sub_end := p_subscription_end_date;
  v_contract_path := nullif(btrim(coalesce(p_contract_path, '')), '');

  v_terms_changed :=
    coalesce(p_is_trial, false) IS DISTINCT FROM coalesce(v_sub.is_trial, false)
    OR date_trunc('minute', p_trial_end_date) IS DISTINCT FROM date_trunc('minute', v_sub.trial_end_date)
    OR date_trunc('minute', p_subscription_end_date) IS DISTINCT FROM date_trunc('minute', v_sub.subscription_end_date);

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

  RETURN jsonb_build_object(
    'organization_id', p_organization_id,
    'effective_status', v_effective_status,
    'is_trial', v_sub.is_trial,
    'trial_end_date', v_sub.trial_end_date,
    'subscription_end_date', v_sub.subscription_end_date,
    'has_active_subscription', v_after->'has_active_subscription',
    'after_state', v_after,
    'contract_path', v_contract_path
  );
END;
$function$;

DROP FUNCTION IF EXISTS public.admin_list_subscription_adjustments(uuid, integer);

CREATE FUNCTION public.admin_list_subscription_adjustments(
  p_organization_id uuid,
  p_limit integer DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  organization_id uuid,
  adjusted_by uuid,
  reason text,
  before_state jsonb,
  after_state jsonb,
  created_at timestamptz,
  contract_path text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  lim int;
BEGIN
  IF NOT public.is_cms_admin() THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;

  lim := greatest(1, least(coalesce(p_limit, 5), 50));

  RETURN QUERY
  SELECT
    a.id,
    a.organization_id,
    a.adjusted_by,
    a.reason,
    a.before_state,
    a.after_state,
    a.created_at,
    a.contract_path
  FROM public.cms_subscription_adjustments a
  WHERE a.organization_id = p_organization_id
  ORDER BY a.created_at DESC
  LIMIT lim;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_update_organization_subscription(
  uuid, boolean, timestamptz, timestamptz, text, text
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_update_organization_subscription(
  uuid, boolean, timestamptz, timestamptz, text, text
) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_update_organization_subscription(
  uuid, boolean, timestamptz, timestamptz, text, text
) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.admin_list_subscription_adjustments(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_list_subscription_adjustments(uuid, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_list_subscription_adjustments(uuid, integer)
  TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
