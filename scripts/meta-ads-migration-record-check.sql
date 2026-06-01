SELECT EXISTS (
  SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '20260610120000'
) AS migration_recorded;
