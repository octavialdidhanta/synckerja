-- Catalog add-ons (e.g. omnichannel roster) and which HR plans they attach to.
-- Replaces hardcoded OMNICHANNEL_ADDON_IDR_PER_STAFF_MONTHLY for eligibility + unit pricing.

CREATE TABLE IF NOT EXISTS public.subscription_add_ons (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL,
  name text NOT NULL,
  description text NULL,
  billing_unit text NOT NULL DEFAULT 'per_roster_staff_month',
  default_unit_price_per_month numeric NOT NULL,
  follows_plan_annual_discount boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT subscription_add_ons_pkey PRIMARY KEY (id),
  CONSTRAINT subscription_add_ons_code_unique UNIQUE (code),
  CONSTRAINT subscription_add_ons_default_price_non_negative CHECK (default_unit_price_per_month >= 0)
);

CREATE INDEX IF NOT EXISTS idx_subscription_add_ons_active ON public.subscription_add_ons (is_active);

DROP TRIGGER IF EXISTS subscription_add_ons_updated_at ON public.subscription_add_ons;
CREATE TRIGGER subscription_add_ons_updated_at
  BEFORE UPDATE ON public.subscription_add_ons
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.subscription_plan_add_ons (
  subscription_plan_id uuid NOT NULL REFERENCES public.subscription_plans (id) ON DELETE CASCADE,
  add_on_id uuid NOT NULL REFERENCES public.subscription_add_ons (id) ON DELETE CASCADE,
  unit_price_override_per_month numeric NULL,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT subscription_plan_add_ons_pkey PRIMARY KEY (subscription_plan_id, add_on_id),
  CONSTRAINT subscription_plan_add_ons_override_non_negative CHECK (
    unit_price_override_per_month IS NULL OR unit_price_override_per_month >= 0
  )
);

CREATE INDEX IF NOT EXISTS idx_subscription_plan_add_ons_add_on_id ON public.subscription_plan_add_ons (add_on_id);

ALTER TABLE public.subscription_add_ons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plan_add_ons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "subscription_add_ons_select_active" ON public.subscription_add_ons;
CREATE POLICY "subscription_add_ons_select_active"
  ON public.subscription_add_ons
  FOR SELECT TO authenticated
  USING (is_active = true);

DROP POLICY IF EXISTS "subscription_plan_add_ons_select" ON public.subscription_plan_add_ons;
CREATE POLICY "subscription_plan_add_ons_select"
  ON public.subscription_plan_add_ons
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.subscription_plans p
      WHERE p.id = subscription_plan_id AND p.is_active = true
    )
    AND EXISTS (
      SELECT 1 FROM public.subscription_add_ons a
      WHERE a.id = add_on_id AND a.is_active = true
    )
  );

-- Seed omnichannel roster add-on (matches legacy app constant 125_000 IDR / staff / month).
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
  'omnichannel_roster',
  'Omnichannel roster',
  'Premium omnichannel per staff on organization roster.',
  'per_roster_staff_month',
  125000,
  true,
  true
)
ON CONFLICT (code) DO NOTHING;

-- Junction: paid HR plans excluding trial, starter/start-up/startup, and hidden business tiers (mirrors TS planEligibleForOmnichannelAddonDisplay).
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
ON CONFLICT (subscription_plan_id, add_on_id) DO NOTHING;

COMMENT ON TABLE public.subscription_add_ons IS 'Sellable add-ons (billing separate from base HR seat plan).';
COMMENT ON TABLE public.subscription_plan_add_ons IS 'Which add-ons apply to which subscription_plans row; presence implies eligibility.';
