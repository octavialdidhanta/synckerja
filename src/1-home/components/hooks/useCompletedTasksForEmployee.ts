import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  endOfDay,
  endOfMonth,
  endOfWeek,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { supabase } from "@/shared/lib/supabaseClient";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { useCurrentEmployee } from "@/shared/hooks/useCurrentEmployee";
import {
  DateRangeValue,
  JobDescAssignment,
  JobDescStepAssignment,
  JobDescSubStepAssignment,
  JobDescTaskAssignment,
  JobDescTimeframe,
} from "@/8-2-DailyTask/section/JobDescTracker/types";

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
      const startValue = customRange.start ?? startOfWeek(now, { weekStartsOn: 1 });
      const endValue = customRange.end ?? endOfDay(customRange.start ?? endOfWeek(now, { weekStartsOn: 1 }));
      return { start: startOfDay(startValue), end: endOfDay(endValue) };
    }
    default:
      return {
        start: startOfWeek(now, { weekStartsOn: 1 }),
        end: endOfWeek(now, { weekStartsOn: 1 }),
      };
  }
};

const isDateWithinRange = (value: string | null | undefined, range: DateRangeValue) => {
  if (!value) return false;
  if (!range.start || !range.end) return true;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return date >= range.start && date <= range.end;
};

const isOverdueTask = (completedAt: string, dueDate: string | null): boolean => {
  if (!dueDate || !completedAt) return false;
  const completed = new Date(completedAt);
  const due = new Date(dueDate);
  return completed > due;
};

const fetchCompletedTasksForEmployee = async (
  organizationId: string,
  employeeId: string,
  range: DateRangeValue,
) => {
  const [taskAssignmentsRes, stepAssignmentsRes, subStepAssignmentsRes] =
    await Promise.all([
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
        .eq("organization_id", organizationId)
        .eq("employee_id", employeeId),
      supabase
        .from("task_steps_assigned")
        .select("id, employee_id, assigned_at, task_step_id")
        .eq("organization_id", organizationId)
        .eq("employee_id", employeeId),
      supabase
        .from("task_steps_to_steps_assigned")
        .select("id, employee_id, assigned_at, task_steps_to_steps_id")
        .eq("organization_id", organizationId)
        .eq("employee_id", employeeId),
    ]);

  if (taskAssignmentsRes.error) throw taskAssignmentsRes.error;
  if (stepAssignmentsRes.error) throw stepAssignmentsRes.error;
  if (subStepAssignmentsRes.error) throw subStepAssignmentsRes.error;

  const taskAssignments = (taskAssignmentsRes.data ?? []) as unknown as TaskAssignmentRow[];
  const stepAssignments = (stepAssignmentsRes.data ?? []) as unknown as StepAssignmentRow[];
  const subStepAssignments = (subStepAssignmentsRes.data ?? []) as unknown as SubStepAssignmentRow[];

  // Filter only completed tasks
  const completedTaskAssignments = taskAssignments.filter(
    (assignment) =>
      assignment.daily_task?.status?.toLowerCase() === "completed" &&
      assignment.daily_task?.finish_date
  );

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
    ...((subStepDetailsData ?? []) as unknown as SubStepRecord[])
      .map((sub) => sub.parent_step_id)
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
  completedTaskAssignments.forEach((assignment) => {
    if (assignment.daily_task?.id) {
      taskIds.add(assignment.daily_task.id);
    } else if (assignment.daily_task_id) {
      taskIds.add(assignment.daily_task_id);
    }
  });

  ((stepDetailsData ?? []) as unknown as StepRecord[]).forEach((step) => {
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

  completedTaskAssignments.forEach((assignment) => {
    if (assignment.daily_task) {
      taskMap.set(assignment.daily_task.id, assignment.daily_task);
    }
  });

  const stepDetailMap = new Map<string, StepRecord>();
  ((stepDetailsData ?? []) as unknown as StepRecord[]).forEach((step) => {
    stepDetailMap.set(step.id, step);
  });
  
  const subStepDetailMap = new Map<string, SubStepRecord>();
  ((subStepDetailsData ?? []) as unknown as SubStepRecord[]).forEach((sub) => {
    subStepDetailMap.set(sub.id, sub);
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

  const completedAssignments: JobDescAssignment[] = [];

  // Process completed tasks - only include those completed within the selected timeframe
  completedTaskAssignments.forEach((assignment) => {
    const task = assignment.daily_task ?? taskMap.get(assignment.daily_task_id);
    if (!task || !task.finish_date) return;

    const completedInRange = isDateWithinRange(task.finish_date, range);
    
    // Only show tasks completed within the selected timeframe range
    // This includes both on-time and overdue tasks, as long as they were completed in the range
    if (!completedInRange) return;

    const taskAssignment: JobDescTaskAssignment = {
      type: "task",
      assignmentId: assignment.id,
      taskId: task.id,
      title: task.title ?? "Untitled Task",
      taskTitle: task.title ?? "Untitled Task",
      status: task.status ?? null,
      priority: task.priority ?? null,
      assignedAt: assignment.assigned_at,
      dueDate: task.due_date,
      dueStatus: "onTrack",
      pendingHours: 0,
      completedAt: task.finish_date,
      completedInRange: completedInRange,
    };
    completedAssignments.push(taskAssignment);
  });

  // Process completed steps - only include those completed within the selected timeframe
  stepAssignments.forEach((assignment) => {
    const step = stepDetailMap.get(assignment.task_step_id);
    if (!step || !step.is_completed || !step.completed_at) return;

    const task = taskMap.get(step.task_id ?? "");
    const explicitDueDate = stepDueDates[assignment.id] ?? null;
    const dueDate = explicitDueDate ?? task?.due_date ?? null;
    const completedInRange = isDateWithinRange(step.completed_at, range);
    
    // Only show steps completed within the selected timeframe range
    if (!completedInRange) return;

    const stepAssignment: JobDescStepAssignment = {
      type: "step",
      assignmentId: assignment.id,
      taskId: step.task_id ?? "",
      title: step.title ?? "Step",
      taskTitle: task?.title ?? "Task",
      stepTitle: step.title ?? "Step",
      assignedAt: assignment.assigned_at,
      dueDate,
      dueStatus: "onTrack",
      pendingHours: 0,
      isCompleted: true,
      completedAt: step.completed_at,
      completedInRange: completedInRange,
    };
    completedAssignments.push(stepAssignment);
  });

  // Process completed sub-steps - only include those completed within the selected timeframe
  subStepAssignments.forEach((assignment) => {
    const subStep = subStepDetailMap.get(assignment.task_steps_to_steps_id);
    if (!subStep || !subStep.is_completed || !subStep.completed_at) return;

    const parentStep = stepDetailMap.get(subStep.parent_step_id ?? "");
    const parentTaskId = parentStep?.task_id;
    if (!parentStep || !parentTaskId) return;

    const task = taskMap.get(parentTaskId);
    const dueDate = subStepDueDates[assignment.id] ?? task?.due_date ?? null;
    const completedInRange = isDateWithinRange(subStep.completed_at, range);
    
    // Only show sub-steps completed within the selected timeframe range
    if (!completedInRange) return;

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
      dueStatus: "onTrack",
      pendingHours: 0,
      isCompleted: true,
      completedAt: subStep.completed_at,
      completedInRange: completedInRange,
    };
    completedAssignments.push(subAssignment);
  });

  return completedAssignments;
};

export const useCompletedTasksForEmployee = ({
  timeframe,
  customRange,
}: {
  timeframe: JobDescTimeframe;
  customRange: DateRangeValue;
}) => {
  const { organizationId } = useCurrentOrg();
  const { data: employeeData } = useCurrentEmployee();

  const range = useMemo(() => computeRange(timeframe, customRange), [timeframe, customRange]);

  const employeeId = (employeeData as unknown as { id?: string } | null)?.id 
    ? String((employeeData as unknown as { id: string }).id) 
    : undefined;

  const query = useQuery({
    queryKey: [
      "completed-tasks-employee",
      organizationId,
      employeeId,
      timeframe,
      range.start?.toISOString(),
      range.end?.toISOString(),
    ],
    queryFn: () =>
      organizationId && employeeId
        ? fetchCompletedTasksForEmployee(organizationId, employeeId, range)
        : Promise.resolve([]),
    enabled: Boolean(organizationId && employeeId),
    staleTime: 60 * 1000,
  });

  return {
    ...query,
    data: query.data ?? [],
    range,
  };
};


