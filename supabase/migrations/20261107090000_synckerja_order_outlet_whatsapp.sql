-- Synckerja Order: per-outlet floating WhatsApp button on the public storefront.
--
-- Rules
--   * Number source = omnichannel WhatsApp (public.organization_whatsapp_accounts) only.
--   * Outlet picks one account (whatsapp_account_id). If the org has exactly one active
--     account and the outlet has not picked one, that account is used automatically.
--   * whatsapp_button_enabled = false hides the button for that outlet ("Tanpa WhatsApp").
--   * Prefill message is per outlet (<= 300 chars), supports {outlet} and {meja} placeholders
--     (filled in on the storefront).
--   * The public RPC returns ONLY phone digits + prefill message. Never tokens.

ALTER TABLE public.synckerja_order_outlet_settings
  ADD COLUMN IF NOT EXISTS whatsapp_button_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS whatsapp_account_id uuid
    REFERENCES public.organization_whatsapp_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS whatsapp_prefill_message text;

ALTER TABLE public.synckerja_order_outlet_settings
  DROP CONSTRAINT IF EXISTS synckerja_order_outlet_settings_wa_prefill_len;
ALTER TABLE public.synckerja_order_outlet_settings
  ADD CONSTRAINT synckerja_order_outlet_settings_wa_prefill_len
  CHECK (whatsapp_prefill_message IS NULL OR char_length(whatsapp_prefill_message) <= 300);

CREATE INDEX IF NOT EXISTS synckerja_order_outlet_settings_wa_account_idx
  ON public.synckerja_order_outlet_settings (whatsapp_account_id)
  WHERE whatsapp_account_id IS NOT NULL;

-- The chosen WhatsApp account must belong to the same organization as the outlet settings row.
CREATE OR REPLACE FUNCTION public._synckerja_order_outlet_settings_validate_whatsapp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.whatsapp_account_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.organization_whatsapp_accounts a
    WHERE a.id = NEW.whatsapp_account_id
      AND a.organization_id = NEW.organization_id
  ) THEN
    RAISE EXCEPTION 'whatsapp_account_not_in_organization' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public._synckerja_order_outlet_settings_validate_whatsapp() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS synckerja_order_outlet_settings_validate_whatsapp
  ON public.synckerja_order_outlet_settings;
CREATE TRIGGER synckerja_order_outlet_settings_validate_whatsapp
  BEFORE INSERT OR UPDATE OF whatsapp_account_id, organization_id
  ON public.synckerja_order_outlet_settings
  FOR EACH ROW
  EXECUTE FUNCTION public._synckerja_order_outlet_settings_validate_whatsapp();

-- Public (anon) read for the storefront. Tenant is resolved from the public code only.
CREATE OR REPLACE FUNCTION public.get_public_synckerja_order_whatsapp(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_out record;
  v_settings public.synckerja_order_outlet_settings%ROWTYPE;
  v_account_id uuid;
  v_digits text;
BEGIN
  SELECT * INTO v_out FROM public._synckerja_order_resolve_outlet(p_code);
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  SELECT * INTO v_settings
  FROM public.synckerja_order_outlet_settings
  WHERE outlet_id = v_out.outlet_id AND organization_id = v_out.organization_id;

  IF NOT FOUND OR NOT v_settings.whatsapp_button_enabled THEN
    RETURN jsonb_build_object('ok', false, 'error', 'disabled');
  END IF;

  v_account_id := v_settings.whatsapp_account_id;

  -- Auto-pick only when the org has exactly one active account.
  IF v_account_id IS NULL THEN
    SELECT CASE WHEN count(*) = 1 THEN (array_agg(a.id))[1] END
      INTO v_account_id
    FROM public.organization_whatsapp_accounts a
    WHERE a.organization_id = v_out.organization_id AND a.is_active = true;
  END IF;

  IF v_account_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_selected');
  END IF;

  SELECT nullif(regexp_replace(coalesce(a.display_phone_number, ''), '\D', '', 'g'), '')
    INTO v_digits
  FROM public.organization_whatsapp_accounts a
  WHERE a.id = v_account_id
    AND a.organization_id = v_out.organization_id
    AND a.is_active = true;

  IF v_digits IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'inactive');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'phone_digits', v_digits,
    'prefill_message', nullif(btrim(coalesce(v_settings.whatsapp_prefill_message, '')), '')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_synckerja_order_whatsapp(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_synckerja_order_whatsapp(text) TO anon, authenticated;
