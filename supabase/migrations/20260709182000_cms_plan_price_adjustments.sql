-- Audit trail for CMS admin plan/add-on price changes.
-- RLS enabled with no policies: direct table access denied; only SECURITY DEFINER RPCs.

CREATE TABLE public.cms_plan_price_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('plan', 'add_on', 'plan_add_on')),
  entity_id uuid NOT NULL,
  plan_id uuid NULL REFERENCES public.subscription_plans(id) ON DELETE SET NULL,
  add_on_id uuid NULL REFERENCES public.subscription_add_ons(id) ON DELETE SET NULL,
  adjusted_by uuid NOT NULL REFERENCES auth.users(id),
  reason text NOT NULL CHECK (char_length(trim(reason)) >= 3),
  before_state jsonb NOT NULL,
  after_state jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX cms_plan_price_adjustments_entity_idx
  ON public.cms_plan_price_adjustments (entity_type, entity_id, created_at DESC);

CREATE INDEX cms_plan_price_adjustments_plan_idx
  ON public.cms_plan_price_adjustments (plan_id, created_at DESC)
  WHERE plan_id IS NOT NULL;

ALTER TABLE public.cms_plan_price_adjustments ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.cms_plan_price_adjustments IS
  'CMS admin audit log for subscription_plans, subscription_add_ons, and plan_add_on override changes.';
