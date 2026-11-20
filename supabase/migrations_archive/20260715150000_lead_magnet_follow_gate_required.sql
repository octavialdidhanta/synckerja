-- Wajib follow gate untuk semua user (DM Inbox + push lebih andal).

ALTER TABLE public.lead_magnet_campaigns
  ALTER COLUMN skip_follow_gate_if_follower SET DEFAULT false;

UPDATE public.lead_magnet_campaigns
SET skip_follow_gate_if_follower = false,
    updated_at = now()
WHERE skip_follow_gate_if_follower = true;
