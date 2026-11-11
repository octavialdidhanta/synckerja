-- Karyawan AI add-on: Rp 1.500.000 per karyawan per bulan.
-- CMS /admin/pricing lists this row. Office checkout bills it per seat.
-- Attached to every active plan except Trial.

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
  'ai_employee',
  'Karyawan AI',
  'Satu kursi untuk satu karyawan AI yang masih aktif, per bulan.',
  'per_ai_employee_month',
  1500000,
  true,
  true
)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.subscription_plan_add_ons (subscription_plan_id, add_on_id, display_order)
SELECT sp.id, sa.id, 20
FROM public.subscription_plans sp
CROSS JOIN public.subscription_add_ons sa
WHERE sa.code = 'ai_employee'
  AND sp.is_active = true
  AND lower(trim(sp.name)) <> 'trial'
ON CONFLICT (subscription_plan_id, add_on_id) DO NOTHING;
