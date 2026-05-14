-- Short label (Judul) for product knowledge detail rows (sidebar list + forms).
ALTER TABLE public.product_knowledge_detail
  ADD COLUMN IF NOT EXISTS title text NOT NULL DEFAULT '';

COMMENT ON COLUMN public.product_knowledge_detail.title IS 'Judul/label singkat untuk baris detail (opsional di UI; default kosong untuk baris lama).';
