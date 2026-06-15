-- Raise platform flat fee to Rp 2.500 per VA; clear split rule so xendit-api recreates it at new amount.

ALTER TABLE public.xendit_platform_config
  ALTER COLUMN flat_fee_amount SET DEFAULT 2500;

UPDATE public.xendit_platform_config
SET
  flat_fee_amount = 2500,
  split_rule_id = NULL,
  updated_at = now()
WHERE id = 1;
