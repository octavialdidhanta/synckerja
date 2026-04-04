-- Product Knowledge (Digital Marketing): master features + org-scoped rows.
-- Prerequisites: public.organizations, public.services, public.sub_services, public.employees,
--                public.update_updated_at_column(), public.user_organization_ids().
-- Create product_knowledge_features first (FK target), then product_knowledge.
-- If you only ALTER product_knowledge when the table does not exist, you get 42P01.

-- ---------------------------------------------------------------------------
-- product_knowledge_features
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_knowledge_features (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  service_id uuid NULL REFERENCES public.services (id) ON DELETE SET NULL,
  feature_name text NOT NULL,
  feature_description text NULL,
  solution text NULL,
  competitive_advantage jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_knowledge_features_org ON public.product_knowledge_features USING btree (organization_id);
CREATE INDEX IF NOT EXISTS idx_product_knowledge_features_service ON public.product_knowledge_features USING btree (service_id);

DROP TRIGGER IF EXISTS update_product_knowledge_features_updated_at ON public.product_knowledge_features;
CREATE TRIGGER update_product_knowledge_features_updated_at
  BEFORE UPDATE ON public.product_knowledge_features
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.product_knowledge_features ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "product_knowledge_features_org" ON public.product_knowledge_features;
CREATE POLICY "product_knowledge_features_org" ON public.product_knowledge_features
  FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

-- ---------------------------------------------------------------------------
-- product_knowledge
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_knowledge (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  service_id uuid NULL REFERENCES public.services (id) ON DELETE SET NULL,
  sub_service_id uuid NULL REFERENCES public.sub_services (id) ON DELETE SET NULL,
  feature_id uuid NULL REFERENCES public.product_knowledge_features (id) ON DELETE SET NULL,
  feature_name text NOT NULL DEFAULT ''::text,
  feature_description text NOT NULL DEFAULT ''::text,
  problems_solved text[] NOT NULL DEFAULT '{}'::text[],
  problem_tags text[] NULL,
  impact text NOT NULL DEFAULT ''::text,
  solusi text NULL,
  wants text NULL,
  needs text NULL,
  hidden_needs text NULL,
  false_belief text NULL,
  false_belief_impact text NULL,
  what_makes_them_stop text NULL,
  use_cases jsonb NULL,
  target_audience jsonb NULL,
  competitive_advantage jsonb NULL,
  status text NOT NULL DEFAULT 'draft'::text,
  version integer NOT NULL DEFAULT 1,
  priority text NULL,
  tags text[] NULL,
  categories text[] NULL,
  last_reviewed_date timestamptz NULL,
  owner_id uuid NULL REFERENCES public.employees (id) ON DELETE SET NULL,
  author_id uuid NULL REFERENCES public.employees (id) ON DELETE SET NULL,
  approval_status text NULL,
  approved_by uuid NULL REFERENCES public.employees (id) ON DELETE SET NULL,
  approved_at timestamptz NULL,
  rejection_reason text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_knowledge_org ON public.product_knowledge USING btree (organization_id);
CREATE INDEX IF NOT EXISTS idx_product_knowledge_feature ON public.product_knowledge USING btree (feature_id);
CREATE INDEX IF NOT EXISTS idx_product_knowledge_service ON public.product_knowledge USING btree (service_id);

DROP TRIGGER IF EXISTS update_product_knowledge_updated_at ON public.product_knowledge;
CREATE TRIGGER update_product_knowledge_updated_at
  BEFORE UPDATE ON public.product_knowledge
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.product_knowledge ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "product_knowledge_org" ON public.product_knowledge;
CREATE POLICY "product_knowledge_org" ON public.product_knowledge
  FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));
