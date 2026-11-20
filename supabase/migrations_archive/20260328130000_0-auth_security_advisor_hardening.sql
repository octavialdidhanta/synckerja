-- Security Advisor: fixed search_path on trigger helper; restrictive RLS on tenant tables;
-- email_verification_tokens no longer world-readable (anon uses RPCs).
-- Leaked password protection: enable in Dashboard → Authentication → Attack Protection (not SQL).

-- 1) Function search path (mutable search_path warning)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 2) Helper: org IDs for current user (SECURITY DEFINER avoids RLS recursion on user_organizations)
CREATE OR REPLACE FUNCTION public.user_organization_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT uo.organization_id
  FROM public.user_organizations uo
  WHERE uo.user_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.user_organization_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_organization_ids() TO authenticated;

-- 3) Anon-safe registration / email-link flows (replace open RLS on email_verification_tokens)
CREATE OR REPLACE FUNCTION public.get_latest_signup_verification_token(p_user_id uuid, p_email text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
DECLARE
  v_uid uuid;
  v_token text;
BEGIN
  IF p_user_id IS NULL OR p_email IS NULL OR length(trim(p_email)) = 0 THEN
    RETURN json_build_object('ok', false, 'error', 'invalid_input');
  END IF;

  SELECT u.id INTO v_uid
  FROM auth.users u
  WHERE u.id = p_user_id AND lower(trim(u.email)) = lower(trim(p_email))
  LIMIT 1;

  IF v_uid IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'no_matching_user');
  END IF;

  SELECT t.token INTO v_token
  FROM public.email_verification_tokens t
  WHERE t.user_id = v_uid
  ORDER BY t.created_at DESC
  LIMIT 1;

  IF v_token IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'no_token');
  END IF;

  RETURN json_build_object('ok', true, 'token', v_token);
END;
$$;

REVOKE ALL ON FUNCTION public.get_latest_signup_verification_token(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_latest_signup_verification_token(uuid, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.registration_has_verified_email(p_user_id uuid, p_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
DECLARE
  v_ok boolean;
BEGIN
  IF p_user_id IS NULL OR p_email IS NULL OR length(trim(p_email)) = 0 THEN
    RETURN false;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM auth.users u
    INNER JOIN public.email_verification_tokens t ON t.user_id = u.id
    WHERE u.id = p_user_id
      AND lower(trim(u.email)) = lower(trim(p_email))
      AND t.email_verified = true
  )
  INTO v_ok;

  RETURN COALESCE(v_ok, false);
END;
$$;

REVOKE ALL ON FUNCTION public.registration_has_verified_email(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.registration_has_verified_email(uuid, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_verification_token_snapshot(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
BEGIN
  IF p_token IS NULL OR length(trim(p_token)) = 0 THEN
    RETURN json_build_object('ok', false, 'error', 'invalid_token');
  END IF;

  SELECT t.expires_at, t.email_verified, t.user_id
  INTO r
  FROM public.email_verification_tokens t
  WHERE t.token = p_token
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'not_found');
  END IF;

  RETURN json_build_object(
    'ok', true,
    'expires_at', r.expires_at,
    'email_verified', r.email_verified,
    'user_id', r.user_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_verification_token_snapshot(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_verification_token_snapshot(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.poll_email_verified_by_token(p_token text, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v boolean;
BEGIN
  IF p_token IS NULL OR p_user_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT t.email_verified
  INTO v
  FROM public.email_verification_tokens t
  WHERE t.token = p_token AND t.user_id = p_user_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  RETURN COALESCE(v, false);
END;
$$;

REVOKE ALL ON FUNCTION public.poll_email_verified_by_token(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.poll_email_verified_by_token(text, uuid) TO anon, authenticated;

-- 4) Tighten email_verification_tokens RLS (triggers + SECURITY DEFINER RPCs bypass RLS)
DROP POLICY IF EXISTS "email_verification_tokens_select" ON public.email_verification_tokens;
DROP POLICY IF EXISTS "email_verification_tokens_update" ON public.email_verification_tokens;
DROP POLICY IF EXISTS "email_verification_tokens_insert" ON public.email_verification_tokens;

CREATE POLICY "email_verification_tokens_select_own"
  ON public.email_verification_tokens
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- No anon/insert/update policies: anon uses RPCs; writes via triggers & issue_new_verification_token / confirm_email_verification

-- 5) Multi-tenant tables: replace USING (true)
DROP POLICY IF EXISTS "org_authenticated_all" ON public.organizations;
DROP POLICY IF EXISTS "dept_authenticated_all" ON public.departments;
DROP POLICY IF EXISTS "uo_authenticated_all" ON public.user_organizations;
DROP POLICY IF EXISTS "ur_authenticated_all" ON public.user_roles;
DROP POLICY IF EXISTS "emp_authenticated_all" ON public.employees;
DROP POLICY IF EXISTS "os_authenticated_all" ON public.organization_subscriptions;

-- organizations
CREATE POLICY "organizations_select_member"
  ON public.organizations FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR user_id = auth.uid()
    OR id IN (SELECT public.user_organization_ids())
  );

CREATE POLICY "organizations_insert_creator"
  ON public.organizations FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND user_id = auth.uid());

CREATE POLICY "organizations_update_member"
  ON public.organizations FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid()
    OR user_id = auth.uid()
    OR id IN (SELECT public.user_organization_ids())
  )
  WITH CHECK (
    created_by = auth.uid()
    OR user_id = auth.uid()
    OR id IN (SELECT public.user_organization_ids())
  );

CREATE POLICY "organizations_delete_creator"
  ON public.organizations FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR user_id = auth.uid());

-- departments
CREATE POLICY "departments_select"
  ON public.departments FOR SELECT TO authenticated
  USING (
    organization_id IS NOT NULL
    AND (
      organization_id IN (SELECT public.user_organization_ids())
      OR organization_id IN (
        SELECT o.id FROM public.organizations o
        WHERE o.created_by = auth.uid() OR o.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "departments_insert"
  ON public.departments FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IS NOT NULL
    AND (
      organization_id IN (SELECT public.user_organization_ids())
      OR organization_id IN (
        SELECT o.id FROM public.organizations o
        WHERE o.created_by = auth.uid() OR o.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "departments_update"
  ON public.departments FOR UPDATE TO authenticated
  USING (
    organization_id IS NOT NULL
    AND (
      organization_id IN (SELECT public.user_organization_ids())
      OR organization_id IN (
        SELECT o.id FROM public.organizations o
        WHERE o.created_by = auth.uid() OR o.user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    organization_id IS NOT NULL
    AND (
      organization_id IN (SELECT public.user_organization_ids())
      OR organization_id IN (
        SELECT o.id FROM public.organizations o
        WHERE o.created_by = auth.uid() OR o.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "departments_delete"
  ON public.departments FOR DELETE TO authenticated
  USING (
    organization_id IS NOT NULL
    AND (
      organization_id IN (SELECT public.user_organization_ids())
      OR organization_id IN (
        SELECT o.id FROM public.organizations o
        WHERE o.created_by = auth.uid() OR o.user_id = auth.uid()
      )
    )
  );

-- user_organizations
CREATE POLICY "user_organizations_select"
  ON public.user_organizations FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR organization_id IN (SELECT public.user_organization_ids())
  );

CREATE POLICY "user_organizations_insert"
  ON public.user_organizations FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (
      organization_id IN (
        SELECT o.id FROM public.organizations o
        WHERE o.created_by = auth.uid() OR o.user_id = auth.uid()
      )
      OR organization_id IN (SELECT public.user_organization_ids())
    )
  );

CREATE POLICY "user_organizations_update_own"
  ON public.user_organizations FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_organizations_delete_own"
  ON public.user_organizations FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- user_roles
CREATE POLICY "user_roles_select"
  ON public.user_roles FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR organization_id IN (SELECT public.user_organization_ids())
  );

CREATE POLICY "user_roles_insert"
  ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (
      organization_id IN (
        SELECT o.id FROM public.organizations o
        WHERE o.created_by = auth.uid() OR o.user_id = auth.uid()
      )
      OR organization_id IN (SELECT public.user_organization_ids())
    )
  );

CREATE POLICY "user_roles_update_own"
  ON public.user_roles FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_roles_delete_own"
  ON public.user_roles FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- employees (no organization_id column — scope to own user row)
CREATE POLICY "employees_select_own"
  ON public.employees FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "employees_insert_own"
  ON public.employees FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "employees_update_own"
  ON public.employees FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "employees_delete_own"
  ON public.employees FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- organization_subscriptions
CREATE POLICY "organization_subscriptions_select"
  ON public.organization_subscriptions FOR SELECT TO authenticated
  USING (
    organization_id IN (SELECT public.user_organization_ids())
    OR organization_id IN (
      SELECT o.id FROM public.organizations o
      WHERE o.created_by = auth.uid() OR o.user_id = auth.uid()
    )
  );

CREATE POLICY "organization_subscriptions_insert"
  ON public.organization_subscriptions FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IN (SELECT public.user_organization_ids())
    OR organization_id IN (
      SELECT o.id FROM public.organizations o
      WHERE o.created_by = auth.uid() OR o.user_id = auth.uid()
    )
  );

CREATE POLICY "organization_subscriptions_update"
  ON public.organization_subscriptions FOR UPDATE TO authenticated
  USING (
    organization_id IN (SELECT public.user_organization_ids())
    OR organization_id IN (
      SELECT o.id FROM public.organizations o
      WHERE o.created_by = auth.uid() OR o.user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (SELECT public.user_organization_ids())
    OR organization_id IN (
      SELECT o.id FROM public.organizations o
      WHERE o.created_by = auth.uid() OR o.user_id = auth.uid()
    )
  );

CREATE POLICY "organization_subscriptions_delete"
  ON public.organization_subscriptions FOR DELETE TO authenticated
  USING (
    organization_id IN (SELECT public.user_organization_ids())
    OR organization_id IN (
      SELECT o.id FROM public.organizations o
      WHERE o.created_by = auth.uid() OR o.user_id = auth.uid()
    )
  );
