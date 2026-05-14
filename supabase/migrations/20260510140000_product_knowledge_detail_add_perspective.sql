-- Perspective field for creative / product knowledge detail rows.
ALTER TABLE public.product_knowledge_detail
  ADD COLUMN IF NOT EXISTS perspective text NOT NULL DEFAULT '';

COMMENT ON COLUMN public.product_knowledge_detail.perspective IS 'Sudut pandang / perspective untuk konteks baris detail (opsional di UI; default kosong untuk baris lama).';
