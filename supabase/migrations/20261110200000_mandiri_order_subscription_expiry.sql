-- Mandiri tenants: a past trial or subscription end date closes the public order
-- page the same way a disabled sales POS module does. Sales tenants ignore this
-- date and stay on the POS and WhatsApp Business API toggles.
-- A missing subscription row or a null end date stays open, matching
-- get_subscription_status.

CREATE OR REPLACE FUNCTION public.synckerja_order_subscription_current(
  p_organization_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN COALESCE((
      SELECT o.subscription_self_service_enabled
      FROM public.organizations o
      WHERE o.id = p_organization_id
    ), true) = false THEN true
    ELSE NOT COALESCE((
      SELECT CASE
        WHEN COALESCE(os.is_trial, false)
          THEN os.trial_end_date IS NOT NULL AND os.trial_end_date < now()
        ELSE os.subscription_end_date IS NOT NULL AND os.subscription_end_date < now()
      END
      FROM public.organization_subscriptions os
      WHERE os.organization_id = p_organization_id
      LIMIT 1
    ), false)
  END;
$$;

REVOKE ALL ON FUNCTION public.synckerja_order_subscription_current(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.synckerja_order_subscription_current(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.synckerja_order_subscription_current(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public._synckerja_order_resolve_outlet(p_code text)
RETURNS TABLE (
  organization_id uuid,
  outlet_id uuid,
  outlet_name text,
  public_code text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT o.organization_id, o.id, o.name, o.public_code
  FROM public.pos_outlets o
  JOIN public.synckerja_order_outlet_settings s ON s.outlet_id = o.id AND s.enabled = true
  JOIN public.synckerja_order_org_settings org ON org.organization_id = o.organization_id
    AND org.terms_accepted_at IS NOT NULL
  WHERE o.public_code = lower(btrim(p_code))
    AND o.is_deleted = false
    AND o.is_active = true
    AND public.synckerja_order_sales_module_enabled(o.organization_id, 'pos')
    AND public.synckerja_order_subscription_current(o.organization_id)
  LIMIT 1;
END;
$$;

NOTIFY pgrst, 'reload schema';
