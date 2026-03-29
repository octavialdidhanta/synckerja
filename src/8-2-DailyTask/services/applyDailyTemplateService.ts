import { supabase } from '@/shared/lib/supabaseClient';
import { computeStepDueDate } from '@/features/8_2_1_default_prices/utils/sopDateUtils';
import type { DailyTemplate, DailyTemplateStep } from '../types';

export interface ApplyDailyTemplateParams {
  taskId: string;
  dailyTemplateId: string;
  organizationId: string;
  createdByUserId: string | null;
  /** Tanggal Hari H saat menerapkan template; wajib jika template punya step dengan schedule_type (mode Hari H). */
  hariHDate?: string | null;
}

/**
 * Apply a daily template to an existing task: copy steps to task_steps, set daily_tasks.daily_template_id,
 * compute due dates for Hari H steps and store in task_steps_assigned_duedate.
 * Validates: task.daily_template_id IS NULL and task has no steps (one template per task).
 */
export async function applyDailyTemplateToTask(params: ApplyDailyTemplateParams): Promise<void> {
  const { taskId, dailyTemplateId, organizationId, createdByUserId, hariHDate: paramHariHDate } = params;

  const { data: task, error: taskError } = await supabase
    .from('daily_tasks')
    .select('id, daily_template_id')
    .eq('id', taskId)
    .single();

  if (taskError || !task) throw new Error('Task not found');
  if ((task as { daily_template_id?: string | null }).daily_template_id != null) {
    throw new Error('Task already has a template');
  }

  const { data: template, error: templateError } = await supabase
    .from('daily_template')
    .select('*')
    .eq('id', dailyTemplateId)
    .eq('organization_id', organizationId)
    .single();

  if (templateError || !template) throw new Error('Template not found');
  const dt = template as DailyTemplate;

  const { data: templateSteps, error: stepsError } = await supabase
    .from('daily_template_steps')
    .select('*')
    .eq('daily_template_id', dailyTemplateId)
    .order('order', { ascending: true });

  if (stepsError) throw stepsError;
  const steps = (templateSteps ?? []) as DailyTemplateStep[];
  if (steps.length === 0) throw new Error('Template has no steps');

  const { data: currentUserEmployee } = await supabase
    .from('employees')
    .select('id')
    .eq('user_id', createdByUserId)
    .eq('organization_id', organizationId)
    .maybeSingle();
  const currentUserEmployeeId = (currentUserEmployee as { id: string } | null)?.id ?? null;

  const { data: taskAssignments } = await supabase
    .from('daily_tasks_assigned')
    .select('id, employee_id')
    .eq('daily_task_id', taskId)
    .order('assigned_at', { ascending: false })
    .limit(1);
  const firstAssignment = taskAssignments?.[0] as { id: string; employee_id: string } | undefined;
  const stepAssigneeId = firstAssignment?.employee_id ?? currentUserEmployeeId;

  const hasHariHSteps = steps.some((s) => s.schedule_type != null);
  const hariHDateRaw = paramHariHDate ?? dt.hari_h_date ?? null;
  const hariHDate = hariHDateRaw ? new Date(hariHDateRaw) : null;
  if (hasHariHSteps && !hariHDate) {
    throw new Error('Template uses Hari H; pilih tanggal Hari H saat menerapkan template.');
  }

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const order = i + 1;
    const scheduleType = step.schedule_type;
    const scheduleValue = step.schedule_value ?? null;

    let stepDueDate: string | null = null;
    if (scheduleType && hariHDate) {
      stepDueDate = computeStepDueDate(hariHDate, scheduleType, scheduleValue);
    }

    const insertPayload: Record<string, unknown> = {
      task_id: taskId,
      title: step.title,
      description: step.description ?? null,
      is_completed: false,
      order,
      created_by: createdByUserId,
      step_priority: step.step_priority ?? order,
    };
    if (scheduleType != null) {
      insertPayload.schedule_type = scheduleType;
      insertPayload.schedule_value = scheduleValue;
    }

    const { data: newStep, error: stepError } = await supabase
      .from('task_steps')
      .insert(insertPayload)
      .select('id')
      .single();

    if (stepError) throw stepError;
    const stepId = (newStep as { id: string }).id;

    if (stepAssigneeId) {
      const { data: assignmentRecord, error: assignError } = await supabase
        .from('task_steps_assigned')
        .insert({
          organization_id: organizationId,
          task_step_id: stepId,
          employee_id: stepAssigneeId,
          assigned_by: currentUserEmployeeId ?? stepAssigneeId,
          assigned_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (!assignError && assignmentRecord && stepDueDate) {
        await supabase.from('task_steps_assigned_duedate').insert({
          organization_id: organizationId,
          task_steps_assigned_id: (assignmentRecord as { id: string }).id,
          due_date: stepDueDate,
        });
      }
    }
  }

  await supabase
    .from('daily_tasks')
    .update({ daily_template_id: dailyTemplateId, has_steps: true, updated_at: new Date().toISOString() })
    .eq('id', taskId);
}
