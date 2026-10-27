-- Lead Magnet is a flat org add-on (Rp 99k/mo). Allow purchase on Start Up / zero-base
-- plans so mandiri "Buy add-on" works; keep trial + hidden business tiers excluded.

INSERT INTO public.subscription_plan_add_ons (subscription_plan_id, add_on_id, display_order)
SELECT sp.id, sa.id, 10
FROM public.subscription_plans sp
CROSS JOIN public.subscription_add_ons sa
WHERE sa.code = 'lead_magnet'
  AND sa.is_active = true
  AND sp.is_active = true
  AND lower(trim(sp.name)) <> 'trial'
  AND lower(trim(sp.name)) NOT IN ('business', 'business plan')
ON CONFLICT (subscription_plan_id, add_on_id) DO NOTHING;
