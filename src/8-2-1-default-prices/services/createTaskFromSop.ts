import { supabase } from "@/shared/lib/supabaseClient";
import { computeStepDueDate, parseLocalDateString } from "../utils/sopDateUtils";
import type { SopTemplateStep } from "../types/sopTypes";

export interface TaskFormDataForSop {
  title: string;
  description: string;
  status?: string;
  priority?: string;
  objective_id: string | null;
  assigned_to: string | null;
  plan_date?: string | null;
  due_date?: string | null;
}

export interface CreateTaskFromSopParams {
  formData: TaskFormDataForSop;
  organizationId: string;
  createdByUserId: string | null;
  assignedToEmployeeId: string | null;
  sopTemplateId: string;
  steps: SopTemplateStep[];
  tanggalHariH: string;
}

function startOfMonth(isoDate: string): string {
  const d = parseLocalDateString(isoDate);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

export async function createTaskFromSop(params: CreateTaskFromSopParams): Promise<{ taskId: string }> {
  const { formData, organizationId, createdByUserId, assignedToEmployeeId, steps, tanggalHariH } = params;

  const hariHDate = parseLocalDateString(tanggalHariH);
  const planDate = startOfMonth(tanggalHariH);

  const stepDates: string[] = [];
  for (const step of steps) {
    const due = computeStepDueDate(hariHDate, step.schedule_type, step.schedule_value ?? null);
    stepDates.push(due);
  }
  const lastStepDate = stepDates.length ? stepDates.reduce((a, b) => (a > b ? a : b)) : tanggalHariH;
  const taskDueDate = lastStepDate > tanggalHariH ? lastStepDate : tanggalHariH;

  const { data: newTask, error: taskError } = await supabase
    .from("daily_tasks")
    .insert({
      organization_id: organizationId,
      title: formData.title || "",
      description: formData.description || "",
      status: formData.status || "pending",
      priority: formData.priority || "medium",
      due_date: taskDueDate,
      plan_date: planDate,
      objective_id: formData.objective_id || null,
      created_by: createdByUserId,
    })
    .select("id")
    .single();

  if (taskError) throw taskError;
  const taskId = (newTask as { id: string }).id;

  const { data: currentUserEmployee } = await supabase
    .from("employees")
    .select("id")
    .eq("user_id", createdByUserId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  const currentUserEmployeeId = (currentUserEmployee as { id: string } | null)?.id ?? null;

  if (assignedToEmployeeId) {
    await supabase.from("daily_tasks_assigned").insert({
      organization_id: organizationId,
      daily_task_id: taskId,
      employee_id: assignedToEmployeeId,
      assigned_by: currentUserEmployeeId ?? assignedToEmployeeId,
      assigned_at: new Date().toISOString(),
    });
  }

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const stepDueDate = stepDates[i];

    const stepPayload: Record<string, unknown> = {
      task_id: taskId,
      title: step.title,
      description: step.description ?? null,
      is_completed: false,
      order: i + 1,
      created_by: createdByUserId,
      schedule_type: step.schedule_type ?? null,
      schedule_value: step.schedule_value ?? null,
    };

    const { data: newStep, error: stepError } = await supabase
      .from("task_steps")
      .insert(stepPayload)
      .select("id")
      .single();

    if (stepError) throw stepError;
    const stepId = (newStep as { id: string }).id;

    const stepAssigneeId = assignedToEmployeeId ?? currentUserEmployeeId;
    if (stepAssigneeId) {
      const { data: assignmentRecord, error: assignError } = await supabase
        .from("task_steps_assigned")
        .insert({
          organization_id: organizationId,
          task_step_id: stepId,
          employee_id: stepAssigneeId,
          assigned_by: currentUserEmployeeId ?? stepAssigneeId,
          assigned_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (assignError) throw assignError;
      if (assignmentRecord && stepDueDate) {
        const { error: duedateError } = await supabase.from("task_steps_assigned_duedate").insert({
          organization_id: organizationId,
          task_steps_assigned_id: (assignmentRecord as { id: string }).id,
          due_date: stepDueDate,
        });
        if (duedateError) throw duedateError;
      }
    }
  }

  await supabase.from("daily_tasks").update({ has_steps: true }).eq("id", taskId);

  return { taskId };
}
