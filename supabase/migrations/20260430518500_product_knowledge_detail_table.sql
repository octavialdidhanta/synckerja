-- Product knowledge detail blobs per org/service (Product Knowledge module).
-- Prerequisites: public.organizations, public.services, public.sub_services,
--                public.user_organization_ids().

CREATE OR REPLACE FUNCTION public.update_product_knowledge_detail_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = pg_catalog.now();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.product_knowledge_detail (
  id uuid NOT NULL DEFAULT gen_random_uuid (),
  organization_id uuid NOT NULL,
  service_id uuid NULL,
  sub_service_id uuid NULL,
  product_knowledge_content text NOT NULL,
  created_by uuid NULL,
  created_at timestamptz NULL DEFAULT now(),
  updated_at timestamptz NULL DEFAULT now(),
  CONSTRAINT product_knowledge_detail_pkey PRIMARY KEY (id),
  CONSTRAINT product_knowledge_detail_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users (id) ON DELETE SET NULL,
  CONSTRAINT product_knowledge_detail_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations (id) ON DELETE CASCADE,
  CONSTRAINT product_knowledge_detail_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services (id) ON DELETE SET NULL,
  CONSTRAINT product_knowledge_detail_sub_service_id_fkey FOREIGN KEY (sub_service_id) REFERENCES public.sub_services (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_product_knowledge_detail_organization_id ON public.product_knowledge_detail USING btree (organization_id);
CREATE INDEX IF NOT EXISTS idx_product_knowledge_detail_service_id ON public.product_knowledge_detail USING btree (service_id);
CREATE INDEX IF NOT EXISTS idx_product_knowledge_detail_sub_service_id ON public.product_knowledge_detail USING btree (sub_service_id);
CREATE INDEX IF NOT EXISTS idx_product_knowledge_detail_org_service ON public.product_knowledge_detail USING btree (organization_id, service_id);

DROP TRIGGER IF EXISTS trigger_update_product_knowledge_detail_updated_at ON public.product_knowledge_detail;
CREATE TRIGGER trigger_update_product_knowledge_detail_updated_at
  BEFORE UPDATE ON public.product_knowledge_detail
  FOR EACH ROW
  EXECUTE FUNCTION public.update_product_knowledge_detail_updated_at();

ALTER TABLE public.product_knowledge_detail ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "product_knowledge_detail_org" ON public.product_knowledge_detail;
CREATE POLICY "product_knowledge_detail_org" ON public.product_knowledge_detail
  FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));
