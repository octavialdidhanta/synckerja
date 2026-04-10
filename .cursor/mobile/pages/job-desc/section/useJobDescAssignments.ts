import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  differenceInCalendarDays,
  differenceInHours,
  endOfDay,
  endOfMonth,
  endOfWeek,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { devLog } from "@/config/logger";
import { useCurrentOrg } from "@/features/1-login/hooks/useCurrentOrg";
import { fetchRejectedForOrg, type RejectedApprovalLookupRow } from "@/features/8-2-DailyTask/services/completionApprovalService";
import {
  DateRangeValue,
  JobDescAssignment,
  JobDescDueStatus,
  JobDescEmployeeSummary,
  JobDescStepAssignment,
  JobDescSubStepAssignment,
  JobDescTaskAssignment,
  JobDescTimeframe,
  UseJobDescAssignmentsOptions,
} from "./types";

interface TaskRecord {
  id: string;
  title: string | null;
  status: string | null;
  priority: string | null;
  due_date: string | null;
  finish_date: string | null;
}

interface StepRecord {
  id: string;
  title: string | null;
  task_id: string | null;
  is_completed: boolean | null;
  completed_at: string | null;
}

interface SubStepRecord {
  id: string;
  title: string | null;
  parent_step_id: string | null;
  is_completed: boolean | null;
  completed_at: string | null;
}

interface TaskAssignmentRow {
  id: string;
  employee_id: string;
  assigned_at: string | null;
  daily_task_id: string;
  daily_task: TaskRecord | null;
}

interface StepAssignmentRow {
  id: string;
  employee_id: string;
  assigned_at: string | null;
  task_step_id: string;
}

interface SubStepAssignmentRow {
  id: string;
  employee_id: string;
  assigned_at: string | null;
  task_steps_to_steps_id: string;
}

interface EmployeeRow {
  id: string;
  full_name: string | null;
  employee_status_id?: string | null;
  pending_removal?: boolean | null;
}

/** Resigned/non-active statuses that should be excluded from Job Desc Tracker. */
const NON_ACTIVE_STATUSES = new Set(["inactive", "terminated", "pending removal", "pendingremoval"]);

const FALLBACK_RANGE: DateRangeValue = {
  start: startOfWeek(new Date(), { weekStartsOn: 1 }),
  end: endOfWeek(new Date(), { weekStartsOn: 1 }),
};

/** Filter out resigned/inactive/terminated employees (same logic as /employees active filter). */
function isActiveEmployee(
  emp: EmployeeRow,
  statusNameById: Map<string, string>
): boolean {
  if (emp.pending_removal === true) return false;
  const fromRelation = emp.employee_status_id ? statusNameById.get(emp.employee_status_id)?.trim().toLowerCase() : "";
  const effective = fromRelation || "active";
  return !NON_ACTIVE_STATUSES.has(effective);
}

const computeRange = (
  timeframe: JobDescTimeframe,
  customRange: DateRangeValue,
): DateRangeValue => {
  const now = new Date();

  switch (timeframe) {
    case "daily":
      return { start: startOfDay(now), end: endOfDay(now) };
    case "weekly":
      return {
        start: startOfWeek(now, { weekStartsOn: 1 }),
        end: endOfWeek(now, { weekStartsOn: 1 }),
      };
    case "monthly":
      return { start: startOfMonth(now), end: endOfMonth(now) };
    case "custom": {
      const startValue = customRange.start ?? FALLBACK_RANGE.start;
      const endValue =
        customRange.end ?? endOfDay(customRange.start ?? FALLBACK_RANGE.end);
      return { start: startOfDay(startValue), end: endOfDay(endValue) };
    }
    default:
      return FALLBACK_RANGE;
  }
};

const computePendingHours = (assignedAt: string | null): number => {
  if (!assignedAt) return 0;
  const diff = differenceInHours(new Date(), new Date(assignedAt));
  return diff < 0 ? 0 : diff;
};

const determineDueStatus = (
  dueDate: string | null | undefined,
  isCompleted: boolean,
): JobDescDueStatus => {
  if (!dueDate) return "noDue";
  if (isCompleted) return "onTrack";

  const today = startOfDay(new Date());
  const due = startOfDay(new Date(dueDate));
  const diff = differenceInCalendarDays(due, today);

  if (due.getTime() < today.getTime()) {
    return "overdue";
  }

  if (diff <= 3) {
    return "dueSoon";
  }

  return "onTrack";
};

const isOverdue = (dueDate: string | null | undefined, isCompleted: boolean) => {
  if (!dueDate || isCompleted) return false;
  const today = startOfDay(new Date());
  const due = startOfDay(new Date(dueDate));
  return due.getTime() < today.getTime();
};

const isWithinRange = (dueDate: string, range: DateRangeValue) => {
  if (!range.start || !range.end) return true;
  const date = new Date(dueDate);
  return date >= range.start && date <= range.end;
};

const isDateWithinRange = (value: string | null | undefined, range: DateRangeValue) => {
  if (!value) return false;
  if (!range.start || !range.end) return true;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return date >= range.start && date <= range.end;
};

const createEmptySummary = (employee?: EmployeeRow): JobDescEmployeeSummary => ({
  employeeId: employee?.id ?? "unknown",
  name: employee?.full_name ?? "Unknown Employee",
  jobTitle: null,
  assignments: [],
  activeAssignments: [],
  completedAssignments: 0,
  overdueAssignments: [],
  idle: true,
  lastAssignedAt: null,
  longestPendingHours: 0,
  totalTasks: 0,
  totalSteps: 0,
  totalSubSteps: 0,
});

const applyAssignmentToSummary = (
  summary: JobDescEmployeeSummary,
  assignment: JobDescAssignment,
  isActive: boolean,
  completedAtInRange: boolean,
  isOverdue: boolean,
) => {
  summary.assignments.push(assignment);
  if (completedAtInRange) {
    summary.completedAssignments += 1;
  }
  if (isOverdue) {
    summary.overdueAssignments.push(assignment);
  }

  if (!summary.lastAssignedAt || (assignment.assignedAt && new Date(assignment.assignedAt) > new Date(summary.lastAssignedAt))) {
    summary.lastAssignedAt = assignment.assignedAt;
  }

  if (!isActive) {
    return;
  }

  summary.activeAssignments.push(assignment);
  summary.idle = false;
  summary.longestPendingHours = Math.max(
    summary.longestPendingHours,
    assignment.pendingHours,
  );

  if (assignment.type === "task") {
    summary.totalTasks += 1;
  } else if (assignment.type === "step") {
    summary.totalSteps += 1;
  } else if (assignment.type === "subStep") {
    summary.totalSubSteps += 1;
  }
};

/** Build lookup key for rejected approval: task/step/substep + entity id + assignee. */
const getRejectionKey = (row: RejectedApprovalLookupRow): string => {
  if (row.entity_type === "task") return `task_${row.daily_task_id}_${row.assignee_employee_id}`;
  if (row.entity_type === "step" && row.task_step_id) return `step_${row.task_step_id}_${row.assignee_employee_id}`;
  if (row.entity_type === "substep" && row.task_steps_to_steps_id) return `substep_${row.task_steps_to_steps_id}_${row.assignee_employee_id}`;
  return "";
};

const buildSummaries = ({
  employees,
  taskAssignments,
  stepAssignments,
  stepDetails,
  subStepAssignments,
  subStepDetails,
  taskMap,
  stepDueDates,
  subStepDueDates,
  range,
  includeAllOverdue,
  rejectionMap,
}: {
  employees: EmployeeRow[];
  taskAssignments: TaskAssignmentRow[];
  stepAssignments: StepAssignmentRow[];
  stepDetails: StepRecord[];
  subStepAssignments: SubStepAssignmentRow[];
  subStepDetails: SubStepRecord[];
  taskMap: Map<string, TaskRecord>;
  stepDueDates: Record<string, string>;
  subStepDueDates: Record<string, string>;
  range: DateRangeValue;
  includeAllOverdue: boolean;
  rejectionMap: Map<string, string>;
}): JobDescEmployeeSummary[] => {
  const summaryMap = new Map<string, JobDescEmployeeSummary>();

  employees.forEach((employee) => {
    summaryMap.set(employee.id, createEmptySummary(employee));
  });

  const ensureSummary = (employeeId: string): JobDescEmployeeSummary => {
    if (!summaryMap.has(employeeId)) {
      summaryMap.set(employeeId, createEmptySummary());
    }
    return summaryMap.get(employeeId)!;
  };

  const stepDetailMap = new Map(stepDetails.map((step) => [step.id, step]));
  const subStepDetailMap = new Map(
    subStepDetails.map((sub) => [sub.id, sub]),
  );

  taskAssignments.forEach((assignment) => {
    const summary = ensureSummary(assignment.employee_id);
    const task = assignment.daily_task ?? taskMap.get(assignment.daily_task_id);

    if (!task) {
      return;
    }

    const pendingHours = computePendingHours(assignment.assigned_at);
    const dueDate = task.due_date;
    const overdue = isOverdue(dueDate, (task.status ?? "").toLowerCase() === "completed");
    const inRange = dueDate ? isWithinRange(dueDate, range) : false;
    const completedAt = task.finish_date;
    const completedInRange = isDateWithinRange(completedAt, range);
    if (
      (!dueDate || (!inRange && !(includeAllOverdue && overdue))) &&
      !completedInRange
    ) {
      return;
    }
    const dueStatus = determineDueStatus(
      dueDate,
      (task.status ?? "").toLowerCase() === "completed",
    );
    const taskRejectKey = `task_${task.id}_${assignment.employee_id}`;
    const taskRejectReason = rejectionMap.get(taskRejectKey);
    const taskAssignment: JobDescTaskAssignment = {
      type: "task",
      assignmentId: assignment.id,
      taskId: task.id,
      title: task.title ?? "Untitled Task",
      taskTitle: task.title ?? "Untitled Task",
      status: task.status ?? null,
      priority: task.priority ?? null,
      assignedAt: assignment.assigned_at,
      dueDate,
      dueStatus,
      pendingHours,
      completedAt,
      completedInRange,
      rejectReason: taskRejectReason ?? null,
      isRejected: Boolean(taskRejectReason),
    };

    const isActive = (task.status ?? "").toLowerCase() !== "completed";
    applyAssignmentToSummary(
      summary,
      taskAssignment,
      isActive,
      completedInRange,
      overdue,
    );
  });

  stepAssignments.forEach((assignment) => {
    const summary = ensureSummary(assignment.employee_id);
    const step = stepDetailMap.get(assignment.task_step_id);
    if (!step || !step.task_id) {
      return;
    }

    const task = taskMap.get(step.task_id);
    const pendingHours = computePendingHours(assignment.assigned_at);
    const explicitDueDate = stepDueDates[assignment.id] ?? null;
    const dueDate = explicitDueDate ?? task?.due_date ?? null;
    const overdue = isOverdue(dueDate, step.is_completed ?? false);
    const inRange = dueDate ? isWithinRange(dueDate, range) : false;
    const completedAt = step.completed_at;
    const completedInRange = isDateWithinRange(completedAt, range);
    if (
      (!dueDate || (!inRange && !(includeAllOverdue && overdue))) &&
      !completedInRange
    ) {
      return;
    }
    const dueStatus = determineDueStatus(dueDate, step.is_completed ?? false);
    const stepRejectKey = `step_${step.id}_${assignment.employee_id}`;
    const stepRejectReason = rejectionMap.get(stepRejectKey);
    const stepAssignment: JobDescStepAssignment = {
      type: "step",
      assignmentId: assignment.id,
      taskId: step.task_id,
      title: step.title ?? "Step",
      taskTitle: task?.title ?? "Task",
      stepTitle: step.title ?? "Step",
      assignedAt: assignment.assigned_at,
      dueDate,
      dueStatus,
      pendingHours,
      isCompleted: step.is_completed ?? false,
      completedAt,
      completedInRange,
      rejectReason: stepRejectReason ?? null,
      isRejected: Boolean(stepRejectReason),
    };

    const isActive = !(step.is_completed ?? false);
    applyAssignmentToSummary(
      summary,
      stepAssignment,
      isActive,
      completedInRange,
      overdue,
    );
  });

  subStepAssignments.forEach((assignment) => {
    const summary = ensureSummary(assignment.employee_id);
    const subStep = subStepDetailMap.get(assignment.task_steps_to_steps_id);
    if (!subStep || !subStep.parent_step_id) {
      return;
    }

    const parentStep = stepDetailMap.get(subStep.parent_step_id);
    const parentTaskId = parentStep?.task_id;
    if (!parentStep || !parentTaskId) {
      return;
    }

    const task = taskMap.get(parentTaskId);
    const pendingHours = computePendingHours(assignment.assigned_at);
    const dueDate = subStepDueDates[assignment.id] ?? task?.due_date ?? null;
    const overdue = isOverdue(dueDate, subStep.is_completed ?? false);
    const inRange = dueDate ? isWithinRange(dueDate, range) : false;
    const completedAt = subStep.completed_at;
    const completedInRange = isDateWithinRange(completedAt, range);
    if (
      (!dueDate || (!inRange && !(includeAllOverdue && overdue))) &&
      !completedInRange
    ) {
      return;
    }
    const dueStatus = determineDueStatus(dueDate, subStep.is_completed ?? false);
    const subRejectKey = `substep_${assignment.task_steps_to_steps_id}_${assignment.employee_id}`;
    const subRejectReason = rejectionMap.get(subRejectKey);
    const subAssignment: JobDescSubStepAssignment = {
      type: "subStep",
      assignmentId: assignment.id,
      taskId: parentTaskId,
      title: subStep.title ?? "Sub-step",
      taskTitle: task?.title ?? "Task",
      stepTitle: parentStep.title ?? "Step",
      subStepTitle: subStep.title ?? "Sub-step",
      assignedAt: assignment.assigned_at,
      dueDate,
      dueStatus,
      pendingHours,
      isCompleted: subStep.is_completed ?? false,
      completedAt,
      completedInRange,
      rejectReason: subRejectReason ?? null,
      isRejected: Boolean(subRejectReason),
    };

    const isActive = !(subStep.is_completed ?? false);
    applyAssignmentToSummary(
      summary,
      subAssignment,
      isActive,
      completedInRange,
      overdue,
    );
  });

  return Array.from(summaryMap.values()).map((summary) => ({
    ...summary,
    idle: summary.activeAssignments.length === 0,
  }));
};

const fetchAssignments = async (
  organizationId: string,
  range: DateRangeValue,
  includeOverdue: boolean,
) => {
  const [employeesRes, statusesRes, taskAssignmentsRes, stepAssignmentsRes, subStepAssignmentsRes] =
    await Promise.all([
      supabase
        .from("employees")
        .select("id, full_name, employee_status_id, pending_removal")
        .eq("organization_id", organizationId)
        .order("full_name", { ascending: true }),
      supabase.from("employee_statuses").select("id, name"),
      supabase
        .from("daily_tasks_assigned")
        .select(
          `
          id,
          employee_id,
          assigned_at,
          daily_task_id,
          daily_task:daily_task_id(
            id,
            title,
            status,
            priority,
            due_date,
            finish_date
          )
        `,
        )
        .eq("organization_id", organizationId),
      supabase
        .from("task_steps_assigned")
        .select("id, employee_id, assigned_at, task_step_id")
        .eq("organization_id", organizationId),
      supabase
        .from("task_steps_to_steps_assigned")
        .select("id, employee_id, assigned_at, task_steps_to_steps_id")
        .eq("organization_id", organizationId),
    ]);

  if (employeesRes.error) throw employeesRes.error;
  if (taskAssignmentsRes.error) throw taskAssignmentsRes.error;
  if (stepAssignmentsRes.error) throw stepAssignmentsRes.error;
  if (subStepAssignmentsRes.error) throw subStepAssignmentsRes.error;

  const statusNameById = new Map<string, string>();
  if (statusesRes.error) {
    devLog.warn('Job Desc: employee_statuses fetch failed, defaulting unresolved statuses to active', statusesRes.error);
  } else {
    (statusesRes.data ?? []).forEach((s: { id: string; name: string }) => {
      if (s.id && s.name) statusNameById.set(s.id, s.name);
    });
  }

  const allEmployees = (employeesRes.data ?? []) as EmployeeRow[];
  const employees = allEmployees.filter((emp) => isActiveEmployee(emp, statusNameById));
  const activeEmployeeIds = new Set(employees.map((e) => e.id));
  const taskAssignments = ((taskAssignmentsRes.data as TaskAssignmentRow[]) ?? []).filter(
    (a) => activeEmployeeIds.has(a.employee_id),
  );
  const stepAssignments = ((stepAssignmentsRes.data as StepAssignmentRow[]) ?? []).filter(
    (a) => activeEmployeeIds.has(a.employee_id),
  );
  const subStepAssignments = (
    (subStepAssignmentsRes.data as SubStepAssignmentRow[]) ?? []
  ).filter((a) => activeEmployeeIds.has(a.employee_id));

  const { data: rejectedRows } = await fetchRejectedForOrg(organizationId);
  const rejectionMap = new Map<string, string>();
  (rejectedRows ?? []).forEach((row) => {
    const key = getRejectionKey(row);
    if (key && row.reject_reason && !rejectionMap.has(key)) rejectionMap.set(key, row.reject_reason);
  });

  const subStepIds = Array.from(
    new Set(
      subStepAssignments
        .map((assignment) => assignment.task_steps_to_steps_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );

  const { data: subStepDetailsData, error: subStepDetailsError } =
    subStepIds.length
      ? await supabase
          .from("task_steps_to_steps")
          .select("id, parent_step_id, title, is_completed, completed_at")
          .in("id", subStepIds)
      : { data: [], error: null };

  if (subStepDetailsError) throw subStepDetailsError;

  const stepIdsToFetch = new Set<string>([
    ...stepAssignments.map((assignment) => assignment.task_step_id),
    ...(subStepDetailsData ?? [])
      .map((sub: any) => sub.parent_step_id)
      .filter((parentId: string | null): parentId is string => Boolean(parentId)),
  ]);

  const { data: stepDetailsData, error: stepDetailsError } = stepIdsToFetch.size
    ? await supabase
        .from("task_steps")
        .select("id, title, task_id, is_completed, completed_at")
        .in("id", Array.from(stepIdsToFetch))
    : { data: [], error: null };

  if (stepDetailsError) throw stepDetailsError;

  const taskIds = new Set<string>();
  taskAssignments.forEach((assignment) => {
    if (assignment.daily_task?.id) {
      taskIds.add(assignment.daily_task.id);
    } else if (assignment.daily_task_id) {
      taskIds.add(assignment.daily_task_id);
    }
  });

  (stepDetailsData ?? []).forEach((step) => {
    if (step.task_id) {
      taskIds.add(step.task_id);
    }
  });

  const missingTaskIds = Array.from(taskIds);
  const { data: taskRecords, error: taskError } = missingTaskIds.length
    ? await supabase
        .from("daily_tasks")
        .select("id, title, status, priority, due_date, finish_date")
        .in("id", missingTaskIds)
    : { data: [], error: null };

  if (taskError) throw taskError;

  const taskMap = new Map<string, TaskRecord>();
  (taskRecords ?? []).forEach((task) => {
    taskMap.set(task.id, task as TaskRecord);
  });

  taskAssignments.forEach((assignment) => {
    if (assignment.daily_task) {
      taskMap.set(assignment.daily_task.id, assignment.daily_task);
    }
  });

  const stepAssignmentIds = stepAssignments.map((assignment) => assignment.id).filter(Boolean);
  const subStepAssignmentIds = subStepAssignments.map((assignment) => assignment.id).filter(Boolean);

  const stepDueDates: Record<string, string> = {};
  const subStepDueDates: Record<string, string> = {};

  if (stepAssignmentIds.length > 0) {
    const { data: stepDueDateRows } = await supabase
      .from("task_steps_assigned_duedate")
      .select("task_steps_assigned_id, due_date")
      .in("task_steps_assigned_id", stepAssignmentIds)
      .order("created_at", { ascending: false });

    stepDueDateRows?.forEach((row: any) => {
      if (row.task_steps_assigned_id && !stepDueDates[row.task_steps_assigned_id]) {
        stepDueDates[row.task_steps_assigned_id] = row.due_date;
      }
    });
  }

  if (subStepAssignmentIds.length > 0) {
    const { data: subStepDueDateRows } = await supabase
      .from("task_steps_assigned_duedate")
      .select("task_steps_to_steps_assigned_id, due_date")
      .in("task_steps_to_steps_assigned_id", subStepAssignmentIds)
      .order("created_at", { ascending: false });

    subStepDueDateRows?.forEach((row: any) => {
      if (row.task_steps_to_steps_assigned_id && !subStepDueDates[row.task_steps_to_steps_assigned_id]) {
        subStepDueDates[row.task_steps_to_steps_assigned_id] = row.due_date;
      }
    });
  }

  const summaries = buildSummaries({
    employees,
    taskAssignments,
    stepAssignments,
    stepDetails: (stepDetailsData as StepRecord[]) ?? [],
    subStepAssignments,
    subStepDetails: (subStepDetailsData as SubStepRecord[]) ?? [],
    taskMap,
    stepDueDates,
    subStepDueDates,
    range,
    includeAllOverdue: includeOverdue,
    rejectionMap,
  });

  return {
    summaries,
    meta: {
      totalEmployees: employees.length,
      totalAssignments:
        taskAssignments.length + stepAssignments.length + subStepAssignments.length,
    },
  };
};

export const useJobDescAssignments = ({
  timeframe,
  customRange,
  includeOverdue = true,
}: UseJobDescAssignmentsOptions) => {
  const { organizationId } = useCurrentOrg();

  const range = useMemo(() => computeRange(timeframe, customRange), [timeframe, customRange]);

  const query = useQuery({
    queryKey: [
      "job-desc-assignments",
      organizationId,
      timeframe,
      range.start?.toISOString(),
      range.end?.toISOString(),
      includeOverdue,
    ],
    queryFn: () =>
      organizationId ? fetchAssignments(organizationId, range, includeOverdue) : Promise.resolve({ summaries: [], meta: { totalEmployees: 0, totalAssignments: 0 } }),
    enabled: Boolean(organizationId),
    staleTime: 60 * 1000,
  });

  return {
    ...query,
    range,
    organizationId: organizationId ?? null,
  };
};
