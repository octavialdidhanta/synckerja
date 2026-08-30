-- QA: POS staff permissions realtime publication
-- Paste into Supabase SQL Editor.

SELECT c.relname AS table_name
FROM pg_publication_rel pr
JOIN pg_class c ON c.oid = pr.prrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_publication p ON p.oid = pr.prpubid
WHERE p.pubname = 'supabase_realtime'
  AND n.nspname = 'public'
  AND c.relname IN ('pos_employee_role_permissions', 'pos_employee_staff')
ORDER BY c.relname;
