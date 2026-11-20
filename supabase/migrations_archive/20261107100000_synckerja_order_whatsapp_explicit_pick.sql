-- Synckerja Order WhatsApp button: the outlet must always pick a number explicitly,
-- even when the organization has only one connected WhatsApp account (no auto-pick).

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

  IF v_settings.whatsapp_account_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_selected');
  END IF;

  SELECT nullif(regexp_replace(coalesce(a.display_phone_number, ''), '\D', '', 'g'), '')
    INTO v_digits
  FROM public.organization_whatsapp_accounts a
  WHERE a.id = v_settings.whatsapp_account_id
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
