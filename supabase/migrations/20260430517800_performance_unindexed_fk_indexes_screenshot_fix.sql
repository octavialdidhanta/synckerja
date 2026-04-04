-- Performance Advisor (INFO): unindexed foreign keys (screenshot fix)
-- Add missing btree indexes on FK columns that don't have an index yet.
-- Safe to run multiple times via IF NOT EXISTS.

-- ---------------------------------------------------------------------------
-- company_assets: FKs added after initial table (expense_id, receipt_confirmed_by)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_company_assets_purchase_request_id
  ON public.company_assets (purchase_request_id);
CREATE INDEX IF NOT EXISTS idx_company_assets_expense_id
  ON public.company_assets (expense_id);
CREATE INDEX IF NOT EXISTS idx_company_assets_receipt_confirmed_by
  ON public.company_assets (receipt_confirmed_by);

-- ---------------------------------------------------------------------------
-- default_prices: FKs on service_id + sub_service_id
-- (current index starts with organization_id, which doesn't cover joins on FK columns)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_default_prices_service_id
  ON public.default_prices (service_id);
CREATE INDEX IF NOT EXISTS idx_default_prices_sub_service_id
  ON public.default_prices (sub_service_id);

-- ---------------------------------------------------------------------------
-- employee_documents: FKs to auth.users on uploaded_by / verified_by
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_employee_documents_uploaded_by
  ON public.employee_documents (uploaded_by);
CREATE INDEX IF NOT EXISTS idx_employee_documents_verified_by
  ON public.employee_documents (verified_by);

-- ---------------------------------------------------------------------------
-- leave_allocations: FK to auth.users on created_by
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_leave_allocations_created_by
  ON public.leave_allocations (created_by);

-- ---------------------------------------------------------------------------
-- leave_policies: FKs to auth.users on created_by / updated_by
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_leave_policies_created_by
  ON public.leave_policies (created_by);
CREATE INDEX IF NOT EXISTS idx_leave_policies_updated_by
  ON public.leave_policies (updated_by);

-- ---------------------------------------------------------------------------
-- meeting_points: FKs on employee_id / created_by
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_meeting_points_employee_id
  ON public.meeting_points (employee_id);
CREATE INDEX IF NOT EXISTS idx_meeting_points_created_by
  ON public.meeting_points (created_by);

-- ---------------------------------------------------------------------------
-- meeting_point_issues: FK on created_by
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_meeting_point_issues_created_by
  ON public.meeting_point_issues (created_by);

-- ---------------------------------------------------------------------------
-- meeting_point_solutions: FK on created_by
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_meeting_point_solutions_created_by
  ON public.meeting_point_solutions (created_by);

-- ---------------------------------------------------------------------------
-- passwords: FK on category_id
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_passwords_category_id
  ON public.passwords (category_id);

