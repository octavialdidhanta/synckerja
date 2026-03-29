-- Previously this migration dropped FK-covering indexes to silence "Unused Index" on empty DBs,
-- which immediately brought back "Unindexed foreign keys." Those two Performance Advisor INFO
-- checks conflict on low-traffic projects: keep these indexes (see 20260430180000).
-- Intentional no-op; name retained for migration history continuity.

SELECT 1;
