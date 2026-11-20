-- Link creative detail rows to content_pillars (optional).
ALTER TABLE public.product_knowledge_detail
  ADD COLUMN IF NOT EXISTS content_pillar_id uuid NULL REFERENCES public.content_pillars (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_product_knowledge_detail_content_pillar_id
  ON public.product_knowledge_detail USING btree (content_pillar_id);

COMMENT ON COLUMN public.product_knowledge_detail.content_pillar_id IS 'Content pillar tag for this creative row (from content_pillars).';
