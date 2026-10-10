ALTER TABLE public.product_knowledge_features
  ADD COLUMN IF NOT EXISTS sub_service_id uuid NULL REFERENCES public.sub_services (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_product_knowledge_features_sub_service
  ON public.product_knowledge_features USING btree (sub_service_id);
