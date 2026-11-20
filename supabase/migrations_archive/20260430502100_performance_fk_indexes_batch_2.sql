-- Performance Advisor (INFO): unindexed foreign keys - batch 2 / 2
-- Remaining FK indexes from current project Advisor list (apply after batch 1).
-- Remote apply via MCP may be split into part1/part2 migrations with identical SQL.

CREATE INDEX IF NOT EXISTS idx_job_openings_created_by
  ON public.job_openings (created_by);

CREATE INDEX IF NOT EXISTS idx_job_openings_department_id
  ON public.job_openings (department_id);

CREATE INDEX IF NOT EXISTS idx_job_openings_employment_status_id
  ON public.job_openings (employment_status_id);

CREATE INDEX IF NOT EXISTS idx_job_openings_job_level_id
  ON public.job_openings (job_level_id);

CREATE INDEX IF NOT EXISTS idx_job_openings_job_position_id
  ON public.job_openings (job_position_id);

CREATE INDEX IF NOT EXISTS idx_job_positions_department_id
  ON public.job_positions (department_id);

CREATE INDEX IF NOT EXISTS idx_national_holidays_created_by
  ON public.national_holidays (created_by);

CREATE INDEX IF NOT EXISTS idx_office_locations_client_id
  ON public.office_locations (client_id);

CREATE INDEX IF NOT EXISTS idx_office_locations_location_type_id
  ON public.office_locations (location_type_id);

CREATE INDEX IF NOT EXISTS idx_office_locations_sales_person_id
  ON public.office_locations (sales_person_id);

CREATE INDEX IF NOT EXISTS idx_office_locations_created_by
  ON public.office_locations (created_by);

CREATE INDEX IF NOT EXISTS idx_payroll_items_component_id
  ON public.payroll_items (component_id);

CREATE INDEX IF NOT EXISTS idx_payroll_items_organization_id
  ON public.payroll_items (organization_id);

CREATE INDEX IF NOT EXISTS idx_payroll_runs_created_by
  ON public.payroll_runs (created_by);

CREATE INDEX IF NOT EXISTS idx_payroll_runs_tax_configuration_id
  ON public.payroll_runs (tax_configuration_id);

CREATE INDEX IF NOT EXISTS idx_penalty_exemptions_approved_by
  ON public.penalty_exemptions (approved_by);

CREATE INDEX IF NOT EXISTS idx_penalty_exemptions_created_by
  ON public.penalty_exemptions (created_by);

CREATE INDEX IF NOT EXISTS idx_penalty_rules_created_by
  ON public.penalty_rules (created_by);

CREATE INDEX IF NOT EXISTS idx_permission_configurations_created_by
  ON public.permission_configurations (created_by);

CREATE INDEX IF NOT EXISTS idx_question_review_organization_id
  ON public.question_review (organization_id);

CREATE INDEX IF NOT EXISTS idx_question_review_review_category_id
  ON public.question_review (review_category_id);

CREATE INDEX IF NOT EXISTS idx_recruitment_links_created_by
  ON public.recruitment_links (created_by);

CREATE INDEX IF NOT EXISTS idx_recruitment_links_department_id
  ON public.recruitment_links (department_id);

CREATE INDEX IF NOT EXISTS idx_recruitment_skills_organization_id
  ON public.recruitment_skills (organization_id);

CREATE INDEX IF NOT EXISTS idx_sjt_questions_test_id
  ON public.sjt_questions (test_id);

CREATE INDEX IF NOT EXISTS idx_tax_configurations_created_by
  ON public.tax_configurations (created_by);

CREATE INDEX IF NOT EXISTS idx_test_questions_test_id
  ON public.test_questions (test_id);

CREATE INDEX IF NOT EXISTS idx_work_schedule_settings_created_by
  ON public.work_schedule_settings (created_by);
