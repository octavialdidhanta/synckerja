-- Performance Advisor: btree indexes whose leading column matches each foreign key column.
-- Splinter 0001_unindexed_foreign_keys requires idx.col_attnums[1:n] = fk.col_attnums for single-column FKs
-- (a composite index on (organization_id, employee_id, ...) does not cover FK on employee_id).

-- Home / OKR / attendance (20260430210000, 20260430220000 align)
CREATE INDEX IF NOT EXISTS idx_allowed_ip_addresses_organization_id
  ON public.allowed_ip_addresses (organization_id);

CREATE INDEX IF NOT EXISTS idx_attendance_records_employee_id
  ON public.attendance_records (employee_id);

CREATE INDEX IF NOT EXISTS idx_attendance_validations_attendance_record_id
  ON public.attendance_validations (attendance_record_id);

CREATE INDEX IF NOT EXISTS idx_clients_organization_id
  ON public.clients (organization_id);

CREATE INDEX IF NOT EXISTS idx_location_types_organization_id
  ON public.location_types (organization_id);

CREATE INDEX IF NOT EXISTS idx_okr_cycles_organization_id
  ON public.okr_cycles (organization_id);

CREATE INDEX IF NOT EXISTS idx_company_objectives_organization_id
  ON public.company_objectives (organization_id);
CREATE INDEX IF NOT EXISTS idx_company_objectives_cycle_id
  ON public.company_objectives (cycle_id);
CREATE INDEX IF NOT EXISTS idx_company_objectives_owner_id
  ON public.company_objectives (owner_id);
CREATE INDEX IF NOT EXISTS idx_company_objectives_created_by
  ON public.company_objectives (created_by);

CREATE INDEX IF NOT EXISTS idx_department_objectives_cycle_id
  ON public.department_objectives (cycle_id);
CREATE INDEX IF NOT EXISTS idx_department_objectives_company_objective_id
  ON public.department_objectives (company_objective_id);
CREATE INDEX IF NOT EXISTS idx_department_objectives_department_id
  ON public.department_objectives (department_id);
CREATE INDEX IF NOT EXISTS idx_department_objectives_owner_id
  ON public.department_objectives (owner_id);
CREATE INDEX IF NOT EXISTS idx_department_objectives_created_by
  ON public.department_objectives (created_by);

CREATE INDEX IF NOT EXISTS idx_individual_objectives_organization_id
  ON public.individual_objectives (organization_id);
CREATE INDEX IF NOT EXISTS idx_individual_objectives_cycle_id
  ON public.individual_objectives (cycle_id);
CREATE INDEX IF NOT EXISTS idx_individual_objectives_department_objective_id
  ON public.individual_objectives (department_objective_id);
CREATE INDEX IF NOT EXISTS idx_individual_objectives_employee_id
  ON public.individual_objectives (employee_id);
CREATE INDEX IF NOT EXISTS idx_individual_objectives_created_by
  ON public.individual_objectives (created_by);

CREATE INDEX IF NOT EXISTS idx_key_results_company_objective_id
  ON public.key_results (company_objective_id);
CREATE INDEX IF NOT EXISTS idx_key_results_individual_objective_id
  ON public.key_results (individual_objective_id);

CREATE INDEX IF NOT EXISTS idx_weekly_checkins_organization_id
  ON public.weekly_checkins (organization_id);
CREATE INDEX IF NOT EXISTS idx_weekly_checkins_employee_id
  ON public.weekly_checkins (employee_id);
CREATE INDEX IF NOT EXISTS idx_weekly_checkins_individual_objective_id
  ON public.weekly_checkins (individual_objective_id);

CREATE INDEX IF NOT EXISTS idx_motivations_organization_id
  ON public.motivations (organization_id);
CREATE INDEX IF NOT EXISTS idx_motivations_created_by
  ON public.motivations (created_by);

CREATE INDEX IF NOT EXISTS idx_motivation_likes_organization_id
  ON public.motivation_likes (organization_id);

CREATE INDEX IF NOT EXISTS idx_employee_status_employee_id
  ON public.employee_status (employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_status_organization_id
  ON public.employee_status (organization_id);

CREATE INDEX IF NOT EXISTS idx_training_programs_organization_id
  ON public.training_programs (organization_id);

CREATE INDEX IF NOT EXISTS idx_training_participants_employee_id
  ON public.training_participants (employee_id);

CREATE INDEX IF NOT EXISTS idx_leave_requests_employee_id
  ON public.leave_requests (employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_organization_id
  ON public.leave_requests (organization_id);

CREATE INDEX IF NOT EXISTS idx_office_locations_organization_id
  ON public.office_locations (organization_id);

CREATE INDEX IF NOT EXISTS idx_work_schedule_settings_organization_id
  ON public.work_schedule_settings (organization_id);

CREATE INDEX IF NOT EXISTS idx_employee_face_registrations_employee_id
  ON public.employee_face_registrations (employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_face_registrations_organization_id
  ON public.employee_face_registrations (organization_id);

CREATE INDEX IF NOT EXISTS idx_key_result_approvals_key_result_id
  ON public.key_result_approvals (key_result_id);

-- Employees: FK columns added for home embeds (no leading-column index otherwise)
CREATE INDEX IF NOT EXISTS idx_employees_department_id
  ON public.employees (department_id);
CREATE INDEX IF NOT EXISTS idx_employees_job_position_id
  ON public.employees (job_position_id);
CREATE INDEX IF NOT EXISTS idx_employees_job_level_id
  ON public.employees (job_level_id);

-- Daily tasks (20260430220000_daily_tasks_blockers_reference_core)
CREATE INDEX IF NOT EXISTS idx_daily_template_department_id
  ON public.daily_template (department_id);

CREATE INDEX IF NOT EXISTS idx_daily_tasks_created_by
  ON public.daily_tasks (created_by);
CREATE INDEX IF NOT EXISTS idx_daily_tasks_daily_template_id
  ON public.daily_tasks (daily_template_id);

CREATE INDEX IF NOT EXISTS idx_daily_tasks_assigned_organization_id
  ON public.daily_tasks_assigned (organization_id);
CREATE INDEX IF NOT EXISTS idx_daily_tasks_assigned_employee_id
  ON public.daily_tasks_assigned (employee_id);
CREATE INDEX IF NOT EXISTS idx_daily_tasks_assigned_assigned_by
  ON public.daily_tasks_assigned (assigned_by);
CREATE INDEX IF NOT EXISTS idx_daily_tasks_assigned_department_id
  ON public.daily_tasks_assigned (department_id);

CREATE INDEX IF NOT EXISTS idx_completion_approvals_daily_task_id
  ON public.completion_approvals (daily_task_id);
CREATE INDEX IF NOT EXISTS idx_completion_approvals_task_step_id
  ON public.completion_approvals (task_step_id);
CREATE INDEX IF NOT EXISTS idx_completion_approvals_task_steps_to_steps_id
  ON public.completion_approvals (task_steps_to_steps_id);
CREATE INDEX IF NOT EXISTS idx_completion_approvals_assignee_employee_id
  ON public.completion_approvals (assignee_employee_id);
CREATE INDEX IF NOT EXISTS idx_completion_approvals_assigner_employee_id
  ON public.completion_approvals (assigner_employee_id);

CREATE INDEX IF NOT EXISTS idx_task_step_history_created_by
  ON public.task_step_history (created_by);
CREATE INDEX IF NOT EXISTS idx_task_step_history_organization_id
  ON public.task_step_history (organization_id);
CREATE INDEX IF NOT EXISTS idx_task_step_history_task_id
  ON public.task_step_history (task_id);
CREATE INDEX IF NOT EXISTS idx_task_step_history_employee_id
  ON public.task_step_history (employee_id);

CREATE INDEX IF NOT EXISTS idx_task_step_history_blocker_resolved_created_by
  ON public.task_step_history_blocker_resolved (created_by);
