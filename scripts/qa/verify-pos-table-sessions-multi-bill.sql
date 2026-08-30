-- QA: multi-bill per table (no unique one-open-per-table)
-- Expect: uq_pos_table_sessions_one_open gone; helper index present.

SELECT indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'pos_table_sessions'
  AND indexname IN (
    'uq_pos_table_sessions_one_open',
    'idx_pos_table_sessions_open_by_table'
  )
ORDER BY indexname;
-- Expected rows: only idx_pos_table_sessions_open_by_table
