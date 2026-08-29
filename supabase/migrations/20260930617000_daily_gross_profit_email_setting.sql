-- Daily Gross Profit email toggle on operational email settings

ALTER TABLE public.operational_email_notification_settings
  ADD COLUMN IF NOT EXISTS daily_gross_profit_enabled boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.operational_email_notification_settings.daily_gross_profit_enabled IS
  'Include Gross Profit block in the daily operational email (00:15 WIB).';

DROP FUNCTION IF EXISTS public.upsert_operational_email_notification_settings(uuid, boolean, boolean, boolean);

CREATE OR REPLACE FUNCTION public.upsert_operational_email_notification_settings(
  p_organization_id uuid,
  p_daily_sales_summary_enabled boolean,
  p_inventory_alerts_enabled boolean,
  p_promo_update_enabled boolean,
  p_daily_gross_profit_enabled boolean DEFAULT true
)
RETURNS public.operational_email_notification_settings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_row public.operational_email_notification_settings;
BEGIN
  IF p_organization_id IS NULL THEN
    RAISE EXCEPTION 'organization_id_required';
  END IF;

  IF NOT public.user_is_org_owner_or_admin(p_organization_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  INSERT INTO public.operational_email_notification_settings (
    organization_id,
    daily_sales_summary_enabled,
    inventory_alerts_enabled,
    promo_update_enabled,
    daily_gross_profit_enabled
  )
  VALUES (
    p_organization_id,
    COALESCE(p_daily_sales_summary_enabled, true),
    COALESCE(p_inventory_alerts_enabled, true),
    COALESCE(p_promo_update_enabled, true),
    COALESCE(p_daily_gross_profit_enabled, true)
  )
  ON CONFLICT (organization_id) DO UPDATE SET
    daily_sales_summary_enabled = EXCLUDED.daily_sales_summary_enabled,
    inventory_alerts_enabled = EXCLUDED.inventory_alerts_enabled,
    promo_update_enabled = EXCLUDED.promo_update_enabled,
    daily_gross_profit_enabled = EXCLUDED.daily_gross_profit_enabled,
    updated_at = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$fn$;

REVOKE ALL ON FUNCTION public.upsert_operational_email_notification_settings(uuid, boolean, boolean, boolean, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_operational_email_notification_settings(uuid, boolean, boolean, boolean, boolean) TO authenticated;
