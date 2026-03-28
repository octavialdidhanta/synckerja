-- Catalog of subscription offerings (shown on /create-plan).

CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NULL,
  base_price_per_member numeric NOT NULL DEFAULT 0,
  features jsonb NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  is_custom boolean NOT NULL DEFAULT false,
  demo_required boolean NOT NULL DEFAULT false,
  annual_discount_percentage numeric NULL,
  member_discount_tiers jsonb NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  jumlah_hari_trial integer NULL,
  CONSTRAINT subscription_plans_pkey PRIMARY KEY (id),
  CONSTRAINT subscription_plans_name_unique UNIQUE (name)
);

CREATE INDEX IF NOT EXISTS idx_subscription_plans_active ON public.subscription_plans (is_active);

DROP TRIGGER IF EXISTS subscription_plans_updated_at ON public.subscription_plans;
CREATE TRIGGER subscription_plans_updated_at
  BEFORE UPDATE ON public.subscription_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "subscription_plans_select_active" ON public.subscription_plans;
CREATE POLICY "subscription_plans_select_active"
  ON public.subscription_plans
  FOR SELECT TO authenticated
  USING (is_active = true);

-- Optional link from org subscription row to catalog (plan_key remains for compatibility).
ALTER TABLE public.organization_subscriptions
  ADD COLUMN IF NOT EXISTS subscription_plan_id uuid NULL REFERENCES public.subscription_plans (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_organization_subscriptions_plan_id
  ON public.organization_subscriptions (subscription_plan_id);

-- Seed default plans (name matches legacy plan_key values).
INSERT INTO public.subscription_plans (
  name,
  description,
  base_price_per_member,
  features,
  is_active,
  is_custom,
  demo_required,
  annual_discount_percentage,
  jumlah_hari_trial
)
VALUES
  (
    'starter',
    'Paket untuk tim kecil — fitur HR inti Synckerja Office.',
    99000,
    '["Hingga 10 anggota", "Fitur HR dasar", "Dukungan email"]'::jsonb,
    true,
    false,
    false,
    10,
    14
  ),
  (
    'pro',
    'Fitur lanjutan dan kapasitas untuk organisasi yang berkembang.',
    199000,
    '["Anggota lebih besar", "Pelaporan lanjutan", "Dukungan prioritas"]'::jsonb,
    true,
    false,
    false,
    15,
    14
  )
ON CONFLICT (name) DO NOTHING;
