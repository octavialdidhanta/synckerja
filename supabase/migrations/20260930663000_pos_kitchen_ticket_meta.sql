-- KDS ticket snapshot: customer name + bill-level sales type.

ALTER TABLE public.pos_kitchen_tickets
  ADD COLUMN IF NOT EXISTS customer_name text,
  ADD COLUMN IF NOT EXISTS sales_type_id uuid,
  ADD COLUMN IF NOT EXISTS sales_type_label text;

COMMENT ON COLUMN public.pos_kitchen_tickets.customer_name IS
  'Guest name snapshot at Simpan Bill (nullable).';
COMMENT ON COLUMN public.pos_kitchen_tickets.sales_type_id IS
  'Bill sales type id snapshot (no FK; master may be deleted).';
COMMENT ON COLUMN public.pos_kitchen_tickets.sales_type_label IS
  'Bill sales type display label snapshot.';
