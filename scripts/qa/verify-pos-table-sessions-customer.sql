-- QA: pos_table_sessions.customer_name / customer_phone
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'pos_table_sessions'
  AND column_name IN ('customer_name', 'customer_phone')
ORDER BY column_name;
-- Expected: customer_name text YES, customer_phone text YES
