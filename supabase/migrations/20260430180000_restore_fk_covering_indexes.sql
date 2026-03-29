-- Performance Advisor: btree indexes covering foreign keys (public schema).
--
-- On dev/staging with little traffic, Supabase may list these as INFO "Unused Index" (idx_scan=0).
-- Removing them clears that list but brings back INFO "Unindexed foreign keys" — same 16 items reversed.
-- Production: keep these indexes for FK checks, DELETE CASCADE, and join performance.
-- Docs: https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index

CREATE INDEX IF NOT EXISTS idx_activities_user_id ON public.activities (user_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_departments_organization_id ON public.departments (organization_id)
  WHERE organization_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_employees_user_id ON public.employees (user_id)
  WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_employees_employee_status_id ON public.employees (employee_status_id)
  WHERE employee_status_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_organization_subscriptions_last_payment_id
  ON public.organization_subscriptions (last_payment_id)
  WHERE last_payment_id IS NOT NULL;

-- CASCADE deletes from auth.users need btree on referencing columns
CREATE INDEX IF NOT EXISTS idx_ownership_transfers_from_user ON public.ownership_transfers (from_user_id);

CREATE INDEX IF NOT EXISTS idx_payments_user_id ON public.payments (user_id)
  WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_plan_id ON public.payments (plan_id)
  WHERE plan_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_active_organization_id ON public.profiles (active_organization_id)
  WHERE active_organization_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_subscription_change_requests_org
  ON public.subscription_change_requests (organization_id);
CREATE INDEX IF NOT EXISTS idx_subscription_change_requests_current_plan_id
  ON public.subscription_change_requests (current_plan_id)
  WHERE current_plan_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_subscription_change_requests_target_plan_id
  ON public.subscription_change_requests (target_plan_id)
  WHERE target_plan_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_subscription_change_requests_requested_by
  ON public.subscription_change_requests (requested_by);

CREATE INDEX IF NOT EXISTS idx_user_organizations_organization_id ON public.user_organizations (organization_id);

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles (user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_organization_id ON public.user_roles (organization_id);
