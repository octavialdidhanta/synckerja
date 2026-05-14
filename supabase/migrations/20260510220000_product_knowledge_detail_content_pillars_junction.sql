-- Many-to-many: creative detail rows can tag multiple content pillars.
CREATE TABLE IF NOT EXISTS public.product_knowledge_detail_content_pillars (
  product_knowledge_detail_id uuid NOT NULL REFERENCES public.product_knowledge_detail (id) ON DELETE CASCADE,
  content_pillar_id uuid NOT NULL REFERENCES public.content_pillars (id) ON DELETE CASCADE,
  CONSTRAINT product_knowledge_detail_content_pillars_pkey PRIMARY KEY (product_knowledge_detail_id, content_pillar_id)
);

CREATE INDEX IF NOT EXISTS idx_pk_detail_content_pillars_pillar
  ON public.product_knowledge_detail_content_pillars USING btree (content_pillar_id);

ALTER TABLE public.product_knowledge_detail_content_pillars ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "product_knowledge_detail_content_pillars_org" ON public.product_knowledge_detail_content_pillars;
CREATE POLICY "product_knowledge_detail_content_pillars_org" ON public.product_knowledge_detail_content_pillars
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.product_knowledge_detail d
      WHERE d.id = product_knowledge_detail_content_pillars.product_knowledge_detail_id
      AND d.organization_id IN (SELECT public.user_organization_ids())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.product_knowledge_detail d
      WHERE d.id = product_knowledge_detail_content_pillars.product_knowledge_detail_id
      AND d.organization_id IN (SELECT public.user_organization_ids())
    )
  );

-- Move legacy single FK into junction rows when column exists (20260510210000).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'product_knowledge_detail'
      AND column_name = 'content_pillar_id'
  ) THEN
    INSERT INTO public.product_knowledge_detail_content_pillars (product_knowledge_detail_id, content_pillar_id)
    SELECT id, content_pillar_id
    FROM public.product_knowledge_detail
    WHERE content_pillar_id IS NOT NULL
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

DROP INDEX IF EXISTS idx_product_knowledge_detail_content_pillar_id;
ALTER TABLE public.product_knowledge_detail DROP COLUMN IF EXISTS content_pillar_id;

COMMENT ON TABLE public.product_knowledge_detail_content_pillars IS 'Tags a product_knowledge_detail creative row with one or more content_pillars.';
