-- QA: pos_kitchen_tickets + lines, RLS, realtime
SELECT to_regclass('public.pos_kitchen_tickets') AS tickets_tbl;
SELECT to_regclass('public.pos_kitchen_ticket_lines') AS lines_tbl;

SELECT relname, relrowsecurity
FROM pg_class
WHERE relname IN ('pos_kitchen_tickets', 'pos_kitchen_ticket_lines')
ORDER BY 1;

SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.pos_kitchen_tickets'::regclass
  AND contype = 'c'
ORDER BY 1;

SELECT polname, polrelid::regclass
FROM pg_policy
WHERE polrelid IN (
  'public.pos_kitchen_tickets'::regclass,
  'public.pos_kitchen_ticket_lines'::regclass
)
ORDER BY 2, 1;

SELECT schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND tablename = 'pos_kitchen_tickets';

-- Meta columns (customer + sales type snapshot)
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'pos_kitchen_tickets'
  AND column_name IN (
    'customer_name',
    'sales_type_id',
    'sales_type_label',
    'is_held',
    'held_at',
    'pause_ms',
    'restore_marker'
  )
ORDER BY 1;

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'pos_kitchen_ticket_lines'
  AND column_name = 'is_done';
