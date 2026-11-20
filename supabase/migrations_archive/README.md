# Archived migrations (read-only)

These 1,102 files are the migration history from before **2026-11-20**. They are kept for
reference and because some tests read individual files, but the Supabase CLI no longer uses
them.

Why they were archived:

- Production history (`supabase_migrations.schema_migrations`) and these files had drifted
  apart: only 76 of 1,034 versions matched, many changes were applied by hand in the SQL
  Editor, 57 versions were used by more than one file, and 324 file names had impossible
  times (e.g. hour 24).
- They could not be replayed in order to rebuild the database.

What replaced them:

- `supabase/migrations/20261120114815_remote_baseline.sql` is a schema dump of production
  taken on 2026-11-20 by `.github/workflows/migration-baseline.yml`. It is the single starting
  point for the migration history.
- New schema changes go in `supabase/migrations/` with a version **later** than the baseline.

Do not add or edit files here.
