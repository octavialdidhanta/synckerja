-- Lead Magnet add-on catalog (flat per organization / month).
-- CMS /admin/pricing lists this row automatically; office enforces entitlement separately.

INSERT INTO public.subscription_add_ons (
  code,
  name,
  description,
  billing_unit,
  default_unit_price_per_month,
  follows_plan_annual_discount,
  is_active
)
VALUES (
  'lead_magnet',
  'Lead Magnet',
  'Instagram/Facebook comment-to-DM automation and lead capture.',
  'per_organization_month',
  99000,
  true,
  true
)
ON CONFLICT (code) DO NOTHING;

-- Junction: paid HR plans excluding trial, starter/start-up/startup, and hidden business tiers
-- (mirrors omnichannel_roster eligibility).
INSERT INTO public.subscription_plan_add_ons (subscription_plan_id, add_on_id, display_order)
SELECT sp.id, sa.id, 10
FROM public.subscription_plans sp
CROSS JOIN public.subscription_add_ons sa
WHERE sa.code = 'lead_magnet'
  AND sp.is_active = true
  AND sp.base_price_per_member > 0
  AND lower(trim(sp.name)) <> 'trial'
  AND lower(trim(sp.name)) NOT IN ('business', 'business plan')
  AND NOT (sp.name ~* '(^|[[:space:]])(starter|start[[:space:]]*up|startup)([[:space:]]|$)')
ON CONFLICT (subscription_plan_id, add_on_id) DO NOTHING;
