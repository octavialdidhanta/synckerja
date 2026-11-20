-- Link service required platforms to OAuth performance accounts (auto-schedule).

ALTER TABLE public.service_required_platforms
  ADD COLUMN IF NOT EXISTS platform_account_id text NULL,
  ADD COLUMN IF NOT EXISTS platform_account_label text NULL;

COMMENT ON COLUMN public.service_required_platforms.platform_account_id IS
  'OAuth account id: TikTok open_id, YouTube channel_id, Meta account_id, LinkedIn page_id';

COMMENT ON COLUMN public.service_required_platforms.platform_account_label IS
  'Display label from performance settings OAuth account at configuration time';
