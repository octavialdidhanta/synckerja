export type JobDescTimeframe = "daily" | "weekly" | "monthly" | "custom";

export interface DateRangeValue {
  start: Date | null;
  end: Date | null;
}

export type JobDescDueStatus = "overdue" | "dueSoon" | "onTrack" | "noDue";

interface JobDescAssignmentBase {
  assignmentId: string;
  taskId: string;
  title: string;
  taskTitle: string;
  assignedAt: string | null;
  dueDate?: string | null;
  dueStatus: JobDescDueStatus;
  pendingHours: number;
  completedAt?: string | null;
  completedInRange?: boolean;
  /** Reason for rejection when assigner rejected completion (shown in Job Desc Detail + main table). */
  rejectReason?: string | null;
  /** True when this assignment was rejected by assigner (show "Revision" badge). */
  isRejected?: boolean;
}

export interface JobDescTaskAssignment extends JobDescAssignmentBase {
  type: "task";
  status: string | null;
  priority: string | null;
}

export interface JobDescStepAssignment extends JobDescAssignmentBase {
  type: "step";
  stepTitle: string;
  isCompleted: boolean;
}

export interface JobDescSubStepAssignment extends JobDescAssignmentBase {
  type: "subStep";
  stepTitle: string;
  subStepTitle: string;
  isCompleted: boolean;
}

export type JobDescAssignment =
  | JobDescTaskAssignment
  | JobDescStepAssignment
  | JobDescSubStepAssignment;

export interface JobDescEmployeeSummary {
  employeeId: string;
  name: string;
  jobTitle?: string | null;
  assignments: JobDescAssignment[];
  activeAssignments: JobDescAssignment[];
  completedAssignments: number;
  overdueAssignments: JobDescAssignment[];
  idle: boolean;
  lastAssignedAt: string | null;
  longestPendingHours: number;
  totalTasks: number;
  totalSteps: number;
  totalSubSteps: number;
}

export interface UseJobDescAssignmentsOptions {
  timeframe: JobDescTimeframe;
  customRange: DateRangeValue;
  includeOverdue?: boolean;
}
