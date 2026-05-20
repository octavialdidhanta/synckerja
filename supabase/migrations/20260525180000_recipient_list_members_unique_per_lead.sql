-- Allow multiple list members with the same phone when they are different CRM leads.
-- Picker shows one row per lead; campaign members are unique per (list, lead_id) or (list, conversation_id).

DROP INDEX IF EXISTS public.uq_whatsapp_recipient_list_members_list_phone;

CREATE UNIQUE INDEX IF NOT EXISTS uq_whatsapp_recipient_list_members_list_lead
  ON public.whatsapp_recipient_list_members (list_id, lead_id)
  WHERE lead_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_whatsapp_recipient_list_members_list_conv
  ON public.whatsapp_recipient_list_members (list_id, conversation_id)
  WHERE conversation_id IS NOT NULL AND lead_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_whatsapp_recipient_list_members_list_phone_file
  ON public.whatsapp_recipient_list_members (list_id, phone_normalized)
  WHERE origin = 'file';

COMMENT ON INDEX public.uq_whatsapp_recipient_list_members_list_lead IS
  'CRM select: one member row per lead per list (same phone on multiple leads allowed).';
