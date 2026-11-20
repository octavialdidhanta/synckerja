-- Performance Advisor (INFO): unindexed foreign keys (screenshot follow-up)
-- Add missing btree indexes for foreign-key columns that are still flagged.

-- ---------------------------------------------------------------------------
-- public.income_transactions (missing covering indexes on FK columns)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_income_transactions_income_type_id
  ON public.income_transactions (income_type_id);

CREATE INDEX IF NOT EXISTS idx_income_transactions_user_id
  ON public.income_transactions (user_id);

CREATE INDEX IF NOT EXISTS idx_income_transactions_category_id
  ON public.income_transactions (category_id);

CREATE INDEX IF NOT EXISTS idx_income_transactions_service_id
  ON public.income_transactions (service_id);

CREATE INDEX IF NOT EXISTS idx_income_transactions_sub_service_id
  ON public.income_transactions (sub_service_id);

CREATE INDEX IF NOT EXISTS idx_income_transactions_created_by
  ON public.income_transactions (created_by);

-- ---------------------------------------------------------------------------
-- public.income_allocations (FK -> auth.users on created_by)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_income_allocations_created_by
  ON public.income_allocations (created_by);

-- ---------------------------------------------------------------------------
-- public.meeting_points (FK -> organizations on organization_id)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_meeting_points_organization_id
  ON public.meeting_points (organization_id);

-- ---------------------------------------------------------------------------
-- public.pricing_templates (FK -> auth.users on created_by)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_pricing_templates_created_by
  ON public.pricing_templates (created_by);

-- ---------------------------------------------------------------------------
-- public.purchase_requests (FK -> auth.users on created_by and paid_by_user_id)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_purchase_requests_created_by
  ON public.purchase_requests (created_by);

CREATE INDEX IF NOT EXISTS idx_purchase_requests_paid_by_user_id
  ON public.purchase_requests (paid_by_user_id);

-- ---------------------------------------------------------------------------
-- public.purchase_request_documents (FK -> auth.users on uploaded_by)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_purchase_request_documents_uploaded_by
  ON public.purchase_request_documents (uploaded_by);

