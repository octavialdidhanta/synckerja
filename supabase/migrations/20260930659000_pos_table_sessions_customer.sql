-- Guest label on open bills (bill list / multi-bill distinction).
ALTER TABLE public.pos_table_sessions
  ADD COLUMN IF NOT EXISTS customer_name text NULL,
  ADD COLUMN IF NOT EXISTS customer_phone text NULL;

COMMENT ON COLUMN public.pos_table_sessions.customer_name IS
  'Optional dine-in guest name from POS Add Customer; shown on bill list.';
COMMENT ON COLUMN public.pos_table_sessions.customer_phone IS
  'Optional guest phone from POS Add Customer.';
