-- Align services / sub_services with reference default-prices dialogs (optional description text).
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS description text NULL;

ALTER TABLE public.sub_services
  ADD COLUMN IF NOT EXISTS description text NULL;
