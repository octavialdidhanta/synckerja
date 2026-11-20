-- Dynamic website form fields from Omnichannel Public API (non-core keys).

ALTER TABLE public.lead_submissions
  ADD COLUMN IF NOT EXISTS form_data jsonb NULL;

COMMENT ON COLUMN public.lead_submissions.form_data IS
  'Dynamic website form fields from Omnichannel Public API (non-core keys).';
