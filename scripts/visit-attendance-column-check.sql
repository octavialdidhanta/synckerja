SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'attendance_rules_settings'
  AND column_name = 'enable_visit_attendance_integration';
