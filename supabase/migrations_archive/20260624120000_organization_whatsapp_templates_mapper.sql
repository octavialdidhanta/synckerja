-- Lead WhatsApp template variable mapping per org + web_id + template (self-service UI).
-- Safe to re-run: IF NOT EXISTS, DROP IF EXISTS policies.

CREATE TABLE IF NOT EXISTS public.organization_whatsapp_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  web_id text NOT NULL,
  purpose text NOT NULL DEFAULT 'lead',
  template_name text NOT NULL,
  template_language text NOT NULL DEFAULT 'id',
  parameter_mapping jsonb NULL,
  body_keys text NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organization_whatsapp_templates_organization_id_fkey
    FOREIGN KEY (organization_id) REFERENCES public.organizations (id) ON DELETE CASCADE
);

ALTER TABLE public.organization_whatsapp_templates
  ADD COLUMN IF NOT EXISTS purpose text NOT NULL DEFAULT 'lead';

ALTER TABLE public.organization_whatsapp_templates
  ADD COLUMN IF NOT EXISTS parameter_mapping jsonb NULL;

ALTER TABLE public.organization_whatsapp_templates
  ADD COLUMN IF NOT EXISTS body_keys text NULL;

ALTER TABLE public.organization_whatsapp_templates
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

ALTER TABLE public.organization_whatsapp_templates
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.organization_whatsapp_templates
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'organization_whatsapp_templates_unique'
  ) THEN
    ALTER TABLE public.organization_whatsapp_templates
      ADD CONSTRAINT organization_whatsapp_templates_unique
      UNIQUE (organization_id, web_id, purpose, template_name, template_language);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS organization_whatsapp_templates_org_web_idx
  ON public.organization_whatsapp_templates (organization_id, web_id, purpose)
  WHERE is_active = true;

COMMENT ON TABLE public.organization_whatsapp_templates IS
  'Per-web_id WhatsApp template body variable mapping for omnichannel public API (lead/invoice).';

COMMENT ON COLUMN public.organization_whatsapp_templates.parameter_mapping IS
  'JSON map slot index (string "1".."n") → lead field key (core column or form_data key).';

COMMENT ON COLUMN public.organization_whatsapp_templates.body_keys IS
  'Legacy comma-separated body keys; superseded by parameter_mapping when present.';

ALTER TABLE public.organization_whatsapp_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organization_whatsapp_templates_select_org ON public.organization_whatsapp_templates;
CREATE POLICY organization_whatsapp_templates_select_org
  ON public.organization_whatsapp_templates FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT p.active_organization_id FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS organization_whatsapp_templates_mutate_admin ON public.organization_whatsapp_templates;
CREATE POLICY organization_whatsapp_templates_mutate_admin
  ON public.organization_whatsapp_templates FOR ALL TO authenticated
  USING (public.get_user_role_in_active_org() IN ('owner', 'admin'))
  WITH CHECK (public.get_user_role_in_active_org() IN ('owner', 'admin'));

-- Backfill parameter_mapping from legacy body_keys (slot order = comma order).
UPDATE public.organization_whatsapp_templates t
SET
  parameter_mapping = sub.mapping,
  updated_at = now()
FROM (
  SELECT
    id,
    (
      SELECT jsonb_object_agg((ord)::text, trim(part))
      FROM unnest(string_to_array(body_keys, ',')) WITH ORDINALITY AS u(part, ord)
      WHERE trim(part) <> ''
    ) AS mapping
  FROM public.organization_whatsapp_templates
  WHERE body_keys IS NOT NULL
    AND trim(body_keys) <> ''
    AND (parameter_mapping IS NULL OR parameter_mapping = '{}'::jsonb)
) sub
WHERE t.id = sub.id
  AND sub.mapping IS NOT NULL;
