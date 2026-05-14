-- Ensure omnichannel_roster add-on is linked for every eligible paid HR plan.
-- Idempotent: only inserts missing (subscription_plan_id, add_on_id) pairs.

INSERT INTO public.subscription_plan_add_ons (subscription_plan_id, add_on_id, display_order)
SELECT sp.id, sa.id, 0
FROM public.subscription_plans sp
CROSS JOIN public.subscription_add_ons sa
WHERE sa.code = 'omnichannel_roster'
  AND sp.is_active = true
  AND sp.base_price_per_member > 0
  AND lower(trim(sp.name)) <> 'trial'
  AND lower(trim(sp.name)) NOT IN ('business', 'business plan')
  AND NOT (sp.name ~* '(^|[[:space:]])(starter|start[[:space:]]*up|startup)([[:space:]]|$)')
  AND NOT EXISTS (
    SELECT 1
    FROM public.subscription_plan_add_ons pao
    WHERE pao.subscription_plan_id = sp.id
      AND pao.add_on_id = sa.id
  );
