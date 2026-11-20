-- Multi-link delivery buttons (max 3) for Lead Magnet DMs.

ALTER TABLE public.lead_magnet_campaigns
  ADD COLUMN IF NOT EXISTS delivery_links jsonb NOT NULL DEFAULT '[]'::jsonb;

UPDATE public.lead_magnet_campaigns
SET delivery_links = jsonb_build_array(
  jsonb_build_object(
    'label', COALESCE(NULLIF(TRIM(delivery_button_label), ''), 'Unduh'),
    'url', COALESCE(delivery_url, '')
  )
)
WHERE COALESCE(jsonb_array_length(delivery_links), 0) = 0
  AND delivery_url IS NOT NULL
  AND TRIM(delivery_url) <> '';
