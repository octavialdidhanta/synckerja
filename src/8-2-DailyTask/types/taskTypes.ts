import { TaskFilters } from '../hooks/useTaskFilterState';

export interface TaskLink {
  id: string;
  task_step_id: string;
  title: string;
  url: string;
  created_at: string;
  is_auto_synced?: boolean;
  source_social_media_plan_id?: string | null;
}

export interface TaskStepHistory {
  id: string;
  task_step_id: string;
  action_type: string;
  old_value?: string;
  new_value?: string;
  description?: string;
  blocker_type?: string;
  blocker_severity?: string;
  brief_type?: string;
  created_at: string;
  updated_at?: string;
  created_by?: string;
}

export interface TaskSubStep {
  id: string;
  parent_step_id: string;
  title: string;
  is_completed: boolean;
  order: number;
  created_at: string;
  updated_at: string;
  assigned_to?: string | null;
  assigned_employee?: {
    id: string;
    full_name: string;
    email?: string;
  } | null;
}

export interface TaskStep {
  id: string;
  task_id: string;
  title: string;
  description?: string | null;
  is_completed: boolean;
  order: number;
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
  created_by?: string | null;
  social_media_plan_id?: string | null;
  is_concept_step?: boolean; // true for Concept step, false for Content step
  files?: TaskFile[];
  links?: TaskLink[];
  history?: TaskStepHistory[];
  assigned_to?: string | null;
  assigned_at?: string | null; // Assignment date/time
  assigned_by?: string | null; // User who assigned the step
  assigned_employee?: {
    id: string;
    full_name: string;
    email?: string;
  } | null;
  assigned_by_employee?: {
    id: string;
    full_name: string;
    email?: string;
  } | null;
  has_assigned_substeps?: boolean; // True if this step has sub-steps assigned to current user
  sub_steps?: TaskSubStep[]; // Sub-steps for this step
  assigned_due_date?: string | null; // Due date from task_steps_assigned_duedate
  completion_date_from_history?: string | null; // Completion date from task_step_history (accurate), or fallback to updated_at
  status?: string;
  priority?: string;
  /** From daily template Hari H: days_before_h, hari_h, working_days_after_h. */
  schedule_type?: string | null;
  /** From daily template Hari H; used with schedule_type. */
  schedule_value?: number | null;
  /** From template; untuk mengurutkan step di tanggal yang sama (angka kecil = atas). */
  step_priority?: number | null;
}

export interface TaskFile {
  id: string;
  task_id: string;
  filename: string;
  file_url: string;
  file_size: number;
  created_at: string;
}

export interface DeadlineHistory {
  id: string;
  task_id: string;
  original_deadline: string;
  new_deadline: string;
  reason: string | null;
  requested_by: string | null;
  requested_at: string;
  approved_by: string | null;
  approved_at: string | null;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
}

export interface RecentStepUpdate {
  id: string;
  task_id: string;
  step_id: string;
  step_title: string;
  task_title: string;
  is_completed: boolean;
  updated_at: string;
  action: 'created' | 'updated' | 'completed' | 'reopened';
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent' | 'needs_to_be_presented';
  due_date: string | null;
  finish_date: string | null;
  plan_date: string | null; // Planned month (format: YYYY-MM-01, first day of month)
  created_at: string;
  updated_at: string;
  organization_id: string;
  created_by: string;
  assigned_to?: string;
  assigned_to_name?: string | null;
  /** Display name of employee who assigned the task (excludes self-assign). */
  assigned_by_name?: string | null;
  has_reminder?: boolean;
  has_steps?: boolean;
  has_substeps?: boolean;
  /** Template used for this task; one template per task. */
  daily_template_id?: string | null;
  /** Individual objective this task is linked to; null = unlinked. */
  objective_id?: string | null;
  /** Resolved title for display (e.g. from useIndividualObjectives). */
  objective_title?: string | null;
  steps: TaskStep[];
  files: TaskFile[];
  deadline_history: DeadlineHistory[];
  progress_percentage: number;
}

export interface SummaryData {
  pending: number;
  inProgress: number;
  completed: number;
  cancelled: number;
  overdue: number;
  totalSteps: number;
  completedSteps: number;
  tasksPlannedThisMonth: number; // Tasks planned for current month based on plan_date
}

export interface RecentStepFilters {
  dateRange: 'today' | 'yesterday' | 'this_week' | 'this_month' | 'last_month' | 'custom';
  actionType: 'all' | 'completed' | 'updated' | 'created' | 'reopened';
  customStartDate?: string;
  customEndDate?: string;
}

// Backward compatibility
export type Filters = TaskFilters;

