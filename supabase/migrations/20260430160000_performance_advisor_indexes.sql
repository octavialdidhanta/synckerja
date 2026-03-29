-- Performance Advisor: remove redundant / duplicate indexes only.
-- Optional FK-covering btree indexes were added then removed in 20260430170000 because
-- on low-traffic projects they stay at idx_scan=0 and trigger "Unused Index" noise; re-add
-- any dropped name from that migration before large scale if EXPLAIN shows seq scans on FK joins.

-- Duplicate of UNIQUE constraint profiles_email_key on (email)
DROP INDEX IF EXISTS public.idx_profiles_email;

-- Redundant: idx_payments_org_status(organization_id, ...) covers organization_id predicates
DROP INDEX IF EXISTS public.idx_payments_organization_id;

-- Partial index with zero use in typical workloads; recreate if default-department queries need it
DROP INDEX IF EXISTS public.idx_departments_is_default;

-- Partial end-date index unused in advisor stats; subscription jobs can add a targeted index later
DROP INDEX IF EXISTS public.idx_org_subscriptions_end_date;
