-- Realtime: POS staff App/Backoffice permission changes (Employee Access checklist)
-- so tablet `/pos/*` picks up ACL without manual reload.

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.pos_employee_role_permissions;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.pos_employee_staff;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;
