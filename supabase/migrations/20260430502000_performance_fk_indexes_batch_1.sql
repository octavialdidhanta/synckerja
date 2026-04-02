-- Performance Advisor (INFO): unindexed foreign keys - batch 1 / 2
-- Add covering btree indexes on FK columns (high-traffic: attendance queue, recruitment,
-- payroll core, IP / face). Re-run Advisor after batch 2; monitor idx_scan before adding more.
-- Remote apply via MCP may be split into part1/part2 migrations with identical SQL.

CREATE INDEX IF NOT EXISTS idx_allowed_ip_addresses_created_by
  ON public.allowed_ip_addresses (created_by);

CREATE INDEX IF NOT EXISTS idx_asset_assignments_assigned_by
  ON public.asset_assignments (assigned_by);

CREATE INDEX IF NOT EXISTS idx_attendance_reminder_queue_employee_id
  ON public.attendance_reminder_queue (employee_id);

CREATE INDEX IF NOT EXISTS idx_attendance_reminder_queue_organization_id
  ON public.attendance_reminder_queue (organization_id);

CREATE INDEX IF NOT EXISTS idx_candidate_documents_candidate_profile_id
  ON public.candidate_documents (candidate_profile_id);

CREATE INDEX IF NOT EXISTS idx_candidate_educations_candidate_profile_id
  ON public.candidate_educations (candidate_profile_id);

CREATE INDEX IF NOT EXISTS idx_candidate_family_members_candidate_profile_id
  ON public.candidate_family_members (candidate_profile_id);

CREATE INDEX IF NOT EXISTS idx_candidate_informal_educations_candidate_profile_id
  ON public.candidate_informal_educations (candidate_profile_id);

CREATE INDEX IF NOT EXISTS idx_candidate_reviews_question_review_id
  ON public.candidate_reviews (question_review_id);

CREATE INDEX IF NOT EXISTS idx_candidate_reviews_review_category_id
  ON public.candidate_reviews (review_category_id);

CREATE INDEX IF NOT EXISTS idx_candidate_tests_test_id
  ON public.candidate_tests (test_id);

CREATE INDEX IF NOT EXISTS idx_candidate_work_experiences_candidate_profile_id
  ON public.candidate_work_experiences (candidate_profile_id);

CREATE INDEX IF NOT EXISTS idx_cognitive_questions_test_id
  ON public.cognitive_questions (test_id);

CREATE INDEX IF NOT EXISTS idx_employee_face_registrations_created_by
  ON public.employee_face_registrations (created_by);

CREATE INDEX IF NOT EXISTS idx_employee_payroll_calculations_employee_id
  ON public.employee_payroll_calculations (employee_id);

CREATE INDEX IF NOT EXISTS idx_employee_payroll_calculations_payroll_period_id
  ON public.employee_payroll_calculations (payroll_period_id);

CREATE INDEX IF NOT EXISTS idx_employee_payroll_calculations_tax_configuration_id
  ON public.employee_payroll_calculations (tax_configuration_id);

CREATE INDEX IF NOT EXISTS idx_employee_payroll_components_organization_id
  ON public.employee_payroll_components (organization_id);

CREATE INDEX IF NOT EXISTS idx_employee_payroll_components_payroll_period_id
  ON public.employee_payroll_components (payroll_period_id);

CREATE INDEX IF NOT EXISTS idx_employee_payroll_components_tax_configuration_id
  ON public.employee_payroll_components (tax_configuration_id);

CREATE INDEX IF NOT EXISTS idx_employee_payroll_info_created_by
  ON public.employee_payroll_info (created_by);

CREATE INDEX IF NOT EXISTS idx_employee_payroll_info_tax_configuration_id
  ON public.employee_payroll_info (tax_configuration_id);

CREATE INDEX IF NOT EXISTS idx_employee_payroll_info_updated_by
  ON public.employee_payroll_info (updated_by);

CREATE INDEX IF NOT EXISTS idx_employee_shifts_created_by
  ON public.employee_shifts (created_by);

CREATE INDEX IF NOT EXISTS idx_job_applications_recruitment_link_id
  ON public.job_applications (recruitment_link_id);
