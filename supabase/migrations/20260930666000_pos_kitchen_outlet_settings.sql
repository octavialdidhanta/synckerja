-- Per-outlet KDS preferences (display mode + which order-type buckets show on the sidebar).

CREATE TABLE IF NOT EXISTS public.pos_kitchen_outlet_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  outlet_id uuid NOT NULL REFERENCES public.pos_outlets (id) ON DELETE CASCADE,
  display_mode text NOT NULL DEFAULT 'classic',
  order_type_visibility jsonb NOT NULL DEFAULT '{"dine_in":true,"takeaway":true,"delivery":true,"pickup":true}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pos_kitchen_outlet_settings_pkey PRIMARY KEY (id),
  CONSTRAINT pos_kitchen_outlet_settings_org_outlet_key UNIQUE (organization_id, outlet_id),
  CONSTRAINT pos_kitchen_outlet_settings_display_mode_check CHECK (
    display_mode IN ('classic', 'tiled')
  )
);

CREATE INDEX IF NOT EXISTS idx_pos_kitchen_outlet_settings_outlet
  ON public.pos_kitchen_outlet_settings (outlet_id);

DROP TRIGGER IF EXISTS update_pos_kitchen_outlet_settings_updated_at
  ON public.pos_kitchen_outlet_settings;
CREATE TRIGGER update_pos_kitchen_outlet_settings_updated_at
  BEFORE UPDATE ON public.pos_kitchen_outlet_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.pos_kitchen_outlet_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pos_kitchen_outlet_settings_org_select"
  ON public.pos_kitchen_outlet_settings;
CREATE POLICY "pos_kitchen_outlet_settings_org_select"
  ON public.pos_kitchen_outlet_settings FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "pos_kitchen_outlet_settings_org_insert"
  ON public.pos_kitchen_outlet_settings;
CREATE POLICY "pos_kitchen_outlet_settings_org_insert"
  ON public.pos_kitchen_outlet_settings FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "pos_kitchen_outlet_settings_org_update"
  ON public.pos_kitchen_outlet_settings;
CREATE POLICY "pos_kitchen_outlet_settings_org_update"
  ON public.pos_kitchen_outlet_settings FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "pos_kitchen_outlet_settings_org_delete"
  ON public.pos_kitchen_outlet_settings;
CREATE POLICY "pos_kitchen_outlet_settings_org_delete"
  ON public.pos_kitchen_outlet_settings FOR DELETE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

COMMENT ON TABLE public.pos_kitchen_outlet_settings IS
  'KDS per-outlet prefs: classic/tiled layout and sidebar order-type visibility (does not affect cashier catalog).';
