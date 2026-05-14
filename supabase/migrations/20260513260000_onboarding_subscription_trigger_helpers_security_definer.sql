-- INSERT into organization_subscriptions runs AFTER triggers that PERFORM
-- refresh_organization_has_active_subscription (SECURITY DEFINER). Invoker trigger
-- functions run as the signed-in role, which does not have EXECUTE on that helper,
-- causing: permission denied for function refresh_organization_has_active_subscription
-- and PostgREST 403 on insert (Create Plan onboarding).

ALTER FUNCTION public.update_organization_subscription_status()
  SECURITY DEFINER
  SET search_path = public;

ALTER FUNCTION public.update_has_active_subscription_on_expiry()
  SECURITY DEFINER
  SET search_path = public;
