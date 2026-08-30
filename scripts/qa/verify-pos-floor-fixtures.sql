-- QA: pos_floor_fixtures table + RLS
SELECT to_regclass('public.pos_floor_fixtures') AS fixtures_tbl;

SELECT relname, relrowsecurity
FROM pg_class
WHERE relname = 'pos_floor_fixtures';

SELECT polname
FROM pg_policy
WHERE polrelid = 'public.pos_floor_fixtures'::regclass
ORDER BY 1;
