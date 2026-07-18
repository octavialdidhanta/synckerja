-- Email collection (Pesan step) split from WhatsApp contact gate (Kontak & Channel).

ALTER TABLE public.lead_magnet_campaigns
  ADD COLUMN IF NOT EXISTS email_collection_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE public.lead_magnet_enrollments
  ADD COLUMN IF NOT EXISTS awaiting_contact_kind text NULL
    CONSTRAINT lead_magnet_enrollments_awaiting_contact_kind_chk
    CHECK (awaiting_contact_kind IS NULL OR awaiting_contact_kind IN ('email', 'phone'));

-- Migrate legacy contact_gate campaigns: enable email collection alongside WA gate.
UPDATE public.lead_magnet_campaigns
SET email_collection_enabled = true
WHERE contact_gate_enabled = true
  AND email_collection_enabled = false;
