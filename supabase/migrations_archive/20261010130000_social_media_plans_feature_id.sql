ALTER TABLE public.social_media_plans
  ADD COLUMN IF NOT EXISTS feature_id uuid NULL REFERENCES public.product_knowledge_features (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_social_media_plans_feature
  ON public.social_media_plans USING btree (feature_id);
