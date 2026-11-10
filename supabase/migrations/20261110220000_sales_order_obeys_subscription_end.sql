-- Public order obeys the subscription end timestamp for every tenant.
-- Sales still also requires the POS module for the menu and the WhatsApp
-- Business API module for the green button. A missing row or a null end
-- date stays open. In-flight paid QRIS keeps using the ungated resolver.

CREATE OR REPLACE FUNCTION public.synckerja_order_subscription_current(
  p_organization_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT NOT COALESCE((
    SELECT CASE
      WHEN COALESCE(os.is_trial, false)
        THEN os.trial_end_date IS NOT NULL AND os.trial_end_date < now()
      ELSE os.subscription_end_date IS NOT NULL AND os.subscription_end_date < now()
    END
    FROM public.organization_subscriptions os
    WHERE os.organization_id = p_organization_id
    LIMIT 1
  ), false);
$$;

REVOKE ALL ON FUNCTION public.synckerja_order_subscription_current(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.synckerja_order_subscription_current(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.synckerja_order_subscription_current(uuid) TO service_role;

NOTIFY pgrst, 'reload schema';
