-- First-touch fbclid capture timestamps for accurate Meta CAPI fbc (fb.1.{clickTime}.{fbclid}).

ALTER TABLE public.analytics_sessions
  ADD COLUMN IF NOT EXISTS fbclid_captured_at timestamptz NULL;

COMMENT ON COLUMN public.analytics_sessions.fbclid_captured_at IS
  'Server time when fbclid was first recorded on this session (first-touch for fbc).';

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS fbclid_captured_at timestamptz NULL;

COMMENT ON COLUMN public.leads.fbclid_captured_at IS
  'First-touch time when fbclid was captured for this lead (used in Meta CAPI fbc).';

ALTER TABLE public.meta_ads_conversion_uploads
  ADD COLUMN IF NOT EXISTS fbc_click_epoch bigint NULL;

COMMENT ON COLUMN public.meta_ads_conversion_uploads.fbc_click_epoch IS
  'Unix seconds used in fbc cookie segment when uploading fbclid conversion (audit).';
