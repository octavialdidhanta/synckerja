-- QA: Ops Settings Bank Account tables + RPC
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('bank_account_outlets', 'bank_account_activity_logs')
ORDER BY 1;

SELECT proname
FROM pg_proc
WHERE proname = 'log_bank_account_activity';

SELECT relname, relrowsecurity
FROM pg_class
WHERE relname IN ('bank_account_outlets', 'bank_account_activity_logs');

-- Free-text short aliases should be gone after normalize migration
SELECT bank_name, count(*) AS n
FROM public.bank_accounts
WHERE upper(btrim(bank_name)) IN (
  'BCA', 'MANDIRI', 'UOB', 'JENIUS', 'BNI', 'BRI', 'BTPN'
)
GROUP BY 1
ORDER BY 1;
