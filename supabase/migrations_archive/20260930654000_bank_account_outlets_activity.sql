-- Bank account ↔ outlet assignment + activity audit for Ops Settings Bank Account page.

CREATE TABLE IF NOT EXISTS public.bank_account_outlets (
  bank_account_id uuid NOT NULL REFERENCES public.bank_accounts (id) ON DELETE CASCADE,
  outlet_id uuid NOT NULL REFERENCES public.pos_outlets (id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bank_account_outlets_pkey PRIMARY KEY (bank_account_id, outlet_id)
);

CREATE INDEX IF NOT EXISTS idx_bank_account_outlets_org
  ON public.bank_account_outlets (organization_id);

CREATE INDEX IF NOT EXISTS idx_bank_account_outlets_outlet
  ON public.bank_account_outlets (outlet_id);

ALTER TABLE public.bank_account_outlets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bank_account_outlets_org_select" ON public.bank_account_outlets;
CREATE POLICY "bank_account_outlets_org_select"
  ON public.bank_account_outlets FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "bank_account_outlets_org_insert" ON public.bank_account_outlets;
CREATE POLICY "bank_account_outlets_org_insert"
  ON public.bank_account_outlets FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "bank_account_outlets_org_delete" ON public.bank_account_outlets;
CREATE POLICY "bank_account_outlets_org_delete"
  ON public.bank_account_outlets FOR DELETE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

COMMENT ON TABLE public.bank_account_outlets IS
  'Maps settlement bank accounts to POS outlets (Ops Settings Bank Account).';

CREATE TABLE IF NOT EXISTS public.bank_account_activity_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  bank_account_id uuid REFERENCES public.bank_accounts (id) ON DELETE SET NULL,
  action text NOT NULL,
  summary text NOT NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bank_account_activity_logs_pkey PRIMARY KEY (id),
  CONSTRAINT bank_account_activity_logs_action_check CHECK (
    action IN ('create', 'update', 'deactivate', 'assign_outlets')
  )
);

CREATE INDEX IF NOT EXISTS idx_bank_account_activity_logs_org_created
  ON public.bank_account_activity_logs (organization_id, created_at DESC);

ALTER TABLE public.bank_account_activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bank_account_activity_logs_org_select"
  ON public.bank_account_activity_logs;
CREATE POLICY "bank_account_activity_logs_org_select"
  ON public.bank_account_activity_logs FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "bank_account_activity_logs_org_insert"
  ON public.bank_account_activity_logs;
CREATE POLICY "bank_account_activity_logs_org_insert"
  ON public.bank_account_activity_logs FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

COMMENT ON TABLE public.bank_account_activity_logs IS
  'Audit trail for Ops Settings Bank Account create/update/deactivate/assign.';

CREATE OR REPLACE FUNCTION public.log_bank_account_activity(
  p_organization_id uuid,
  p_bank_account_id uuid,
  p_action text,
  p_summary text,
  p_meta jsonb DEFAULT '{}'::jsonb
)
RETURNS public.bank_account_activity_logs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.bank_account_activity_logs;
BEGIN
  IF p_organization_id IS NULL OR p_organization_id NOT IN (SELECT public.user_organization_ids()) THEN
    RAISE EXCEPTION 'forbidden_org';
  END IF;

  INSERT INTO public.bank_account_activity_logs (
    organization_id,
    bank_account_id,
    action,
    summary,
    meta,
    actor_user_id
  )
  VALUES (
    p_organization_id,
    p_bank_account_id,
    p_action,
    COALESCE(NULLIF(btrim(p_summary), ''), p_action),
    COALESCE(p_meta, '{}'::jsonb),
    auth.uid()
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.log_bank_account_activity(uuid, uuid, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_bank_account_activity(uuid, uuid, text, text, jsonb) TO authenticated;
