-- Synckerja Order: per-outlet QR print customization settings.

CREATE TABLE IF NOT EXISTS public.synckerja_order_qr_settings (
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  outlet_id uuid NOT NULL REFERENCES public.pos_outlets (id) ON DELETE CASCADE,
  template_id text NOT NULL DEFAULT 'classic',
  headline_text text,
  subheadline_text text,
  footer_text text,
  accent_color text NOT NULL DEFAULT '#2563eb',
  show_logo boolean NOT NULL DEFAULT true,
  show_outlet_name boolean NOT NULL DEFAULT true,
  show_table_name boolean NOT NULL DEFAULT true,
  show_scan_instruction boolean NOT NULL DEFAULT true,
  show_url boolean NOT NULL DEFAULT false,
  paper_size text NOT NULL DEFAULT 'a4',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, outlet_id),
  CONSTRAINT synckerja_order_qr_settings_template_id_check
    CHECK (template_id IN ('classic', 'minimal', 'tent')),
  CONSTRAINT synckerja_order_qr_settings_paper_size_check
    CHECK (paper_size IN ('a4', 'a5')),
  CONSTRAINT synckerja_order_qr_settings_accent_color_check
    CHECK (accent_color ~ '^#[0-9a-fA-F]{6}$')
);

CREATE INDEX IF NOT EXISTS idx_synckerja_order_qr_settings_org
  ON public.synckerja_order_qr_settings (organization_id);

DROP TRIGGER IF EXISTS update_synckerja_order_qr_settings_updated_at ON public.synckerja_order_qr_settings;
CREATE TRIGGER update_synckerja_order_qr_settings_updated_at
  BEFORE UPDATE ON public.synckerja_order_qr_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.synckerja_order_qr_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS synckerja_order_qr_settings_select ON public.synckerja_order_qr_settings;
CREATE POLICY synckerja_order_qr_settings_select
  ON public.synckerja_order_qr_settings FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS synckerja_order_qr_settings_ins ON public.synckerja_order_qr_settings;
CREATE POLICY synckerja_order_qr_settings_ins
  ON public.synckerja_order_qr_settings FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS synckerja_order_qr_settings_upd ON public.synckerja_order_qr_settings;
CREATE POLICY synckerja_order_qr_settings_upd
  ON public.synckerja_order_qr_settings FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

COMMENT ON TABLE public.synckerja_order_qr_settings IS
  'Per-outlet QR table card print customization for Synckerja Order backoffice.';
