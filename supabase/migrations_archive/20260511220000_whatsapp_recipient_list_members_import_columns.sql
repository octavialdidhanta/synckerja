-- File-import recipient rows: persist display fields from CSV/XLS (origin = 'file').
ALTER TABLE public.whatsapp_recipient_list_members
  ADD COLUMN IF NOT EXISTS import_full_name text NULL,
  ADD COLUMN IF NOT EXISTS import_customer_name text NULL,
  ADD COLUMN IF NOT EXISTS import_company text NULL;

COMMENT ON COLUMN public.whatsapp_recipient_list_members.import_full_name IS 'From import file; used when origin=file and no CRM lead.';
COMMENT ON COLUMN public.whatsapp_recipient_list_members.import_customer_name IS 'From import file; optional display.';
COMMENT ON COLUMN public.whatsapp_recipient_list_members.import_company IS 'From import file; optional display.';
