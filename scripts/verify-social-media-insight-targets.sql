SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'social_media_insight_targets';

SELECT policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'social_media_insight_targets'
ORDER BY policyname;
