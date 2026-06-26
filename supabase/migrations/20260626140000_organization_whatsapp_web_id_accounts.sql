-- Per-web_id WhatsApp Business account mapping for omnichannel public API (outbound + inbound attribution).
-- Safe to re-run: IF NOT EXISTS, DROP IF EXISTS policies.

CREATE TABLE IF NOT EXISTS public.organization_whatsapp_web_id_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  web_id text NOT NULL,
  whatsapp_account_id uuid NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organization_whatsapp_web_id_accounts_organization_id_fkey
    FOREIGN KEY (organization_id) REFERENCES public.organizations (id) ON DELETE CASCADE,
  CONSTRAINT organization_whatsapp_web_id_accounts_whatsapp_account_id_fkey
    FOREIGN KEY (whatsapp_account_id) REFERENCES public.organization_whatsapp_accounts (id) ON DELETE CASCADE
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'organization_whatsapp_web_id_accounts_unique'
  ) THEN
    ALTER TABLE public.organization_whatsapp_web_id_accounts
      ADD CONSTRAINT organization_whatsapp_web_id_accounts_unique
      UNIQUE (organization_id, web_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS organization_whatsapp_web_id_accounts_org_web_idx
  ON public.organization_whatsapp_web_id_accounts (organization_id, web_id)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS organization_whatsapp_web_id_accounts_account_idx
  ON public.organization_whatsapp_web_id_accounts (whatsapp_account_id)
  WHERE is_active = true;

COMMENT ON TABLE public.organization_whatsapp_web_id_accounts IS
  'Maps analytics/API web_id to organization_whatsapp_accounts for outbound lead/invoice WA and inbound attribution.';

ALTER TABLE public.organization_whatsapp_web_id_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organization_whatsapp_web_id_accounts_select_org
  ON public.organization_whatsapp_web_id_accounts;
CREATE POLICY organization_whatsapp_web_id_accounts_select_org
  ON public.organization_whatsapp_web_id_accounts FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT p.active_organization_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS organization_whatsapp_web_id_accounts_mutate_admin
  ON public.organization_whatsapp_web_id_accounts;
CREATE POLICY organization_whatsapp_web_id_accounts_mutate_admin
  ON public.organization_whatsapp_web_id_accounts FOR ALL TO authenticated
  USING (public.get_user_role_in_active_org() IN ('owner', 'admin'))
  WITH CHECK (public.get_user_role_in_active_org() IN ('owner', 'admin'));

-- Single active WA account orgs: auto-map all active token web_ids to that account.
INSERT INTO public.organization_whatsapp_web_id_accounts (
  organization_id,
  web_id,
  whatsapp_account_id
)
SELECT DISTINCT
  t.organization_id,
  lower(trim(t.web_id)),
  a.id
FROM public.organization_omnichannel_api_tokens t
JOIN public.organization_whatsapp_accounts a
  ON a.organization_id = t.organization_id
  AND a.is_active = true
WHERE t.is_active = true
  AND trim(t.web_id) <> ''
  AND (
    SELECT count(*)::int
    FROM public.organization_whatsapp_accounts x
    WHERE x.organization_id = t.organization_id
      AND x.is_active = true
  ) = 1
ON CONFLICT (organization_id, web_id) DO NOTHING;
