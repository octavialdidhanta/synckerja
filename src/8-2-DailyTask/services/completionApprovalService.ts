import { supabase } from '@/shared/lib/supabaseClient';
import { calculateProgress, determineStatusFromProgress } from '../utils/taskUtils';

export type CompletionEntityType = 'task' | 'step' | 'substep';

/** Set when Google Drive link is cleared on the plan; UI hides this if the step is completed again. */
export const LINK_REMOVED_FROM_PREVIEW_REJECT_REASON = 'Link removed from Preview';

/** Rejected row is stale: link was removed then the step was re-completed (e.g. link re-added). */
export function isStaleLinkRemovalRejection(row: {
  entity_type: CompletionEntityType;
  reject_reason: string | null;
  task_steps?: { is_completed?: boolean | null } | null;
}): boolean {
  return (
    row.reject_reason === LINK_REMOVED_FROM_PREVIEW_REJECT_REASON &&
    row.entity_type === 'step' &&
    row.task_steps?.is_completed === true
  );
}

export interface CompletionApprovalRow {
  id: string;
  entity_type: CompletionEntityType;
  daily_task_id: string;
  task_step_id: string | null;
  task_steps_to_steps_id: string | null;
  assignee_employee_id: string;
  assigner_employee_id: string;
  status: 'pending' | 'approved' | 'rejected';
  completed_at: string;
  reject_reason: string | null;
  rejected_at?: string | null;
  daily_tasks?: { title: string } | null;
  task_steps?: {
    title: string;
    is_completed?: boolean | null;
    social_media_plan_id?: string | null;
    social_media_plans?: { production_approved: boolean | null; production_status?: string | null } | null;
  } | null;
  task_steps_to_steps?: {
    title: string;
    is_completed?: boolean | null;
  } | null;
  assignee?: { id: string; full_name: string } | null;
}

/**
 * Create a completion_approval record when assignee marks task/step/substep complete.
 */
export async function createCompletionApprovalIfAssignee(params: {
  organizationId: string;
  entityType: CompletionEntityType;
  dailyTaskId: string;
  taskStepId?: string | null;
  taskStepsToStepsId?: string | null;
  assigneeEmployeeId: string;
  assignerEmployeeId: string;
  completedAt: string;
}): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase.from('completion_approvals').insert({
      organization_id: params.organizationId,
      entity_type: params.entityType,
      daily_task_id: params.dailyTaskId,
      task_step_id: params.taskStepId ?? null,
      task_steps_to_steps_id: params.taskStepsToStepsId ?? null,
      assignee_employee_id: params.assigneeEmployeeId,
      assigner_employee_id: params.assignerEmployeeId,
      status: 'pending',
      completed_at: params.completedAt,
    });
    return { error: error ? new Error(error.message) : null };
  } catch (e) {
    return { error: e instanceof Error ? e : new Error(String(e)) };
  }
}

const PENDING_APPROVAL_SELECT =
  'id, entity_type, daily_task_id, task_step_id, task_steps_to_steps_id, assignee_employee_id, assigner_employee_id, status, completed_at, reject_reason, ' +
  'daily_tasks(title), ' +
  'task_steps(title, is_completed, social_media_plan_id, social_media_plans(production_approved, production_status)), ' +
  'task_steps_to_steps(title, is_completed), ' +
  'assignee:employees!assignee_employee_id(id, full_name)';

/**
 * Fetch pending approvals for the current user as assigner (to show "Pending your approval").
 * Includes task/step/substep titles and assignee name for card display.
 */
export async function fetchPendingApprovalsForAssigner(
  organizationId: string,
  assignerEmployeeId: string
): Promise<{ data: CompletionApprovalRow[]; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('completion_approvals')
      .select(PENDING_APPROVAL_SELECT)
      .eq('organization_id', organizationId)
      .eq('assigner_employee_id', assignerEmployeeId)
      .eq('status', 'pending')
      .order('completed_at', { ascending: false });
    if (error) return { data: [], error: new Error(error.message) };
    return { data: (data ?? []) as CompletionApprovalRow[], error: null };
  } catch (e) {
    return { data: [], error: e instanceof Error ? e : new Error(String(e)) };
  }
}

const REJECTED_SELECT =
  'id, entity_type, daily_task_id, task_step_id, task_steps_to_steps_id, assignee_employee_id, assigner_employee_id, status, completed_at, reject_reason, rejected_at, daily_tasks(title), task_steps(title, is_completed), task_steps_to_steps(title, is_completed), assignee:employees!assignee_employee_id(id, full_name)';

/** Minimal row for rejection lookup (Job Desc + main table). */
export interface RejectedApprovalLookupRow {
  entity_type: CompletionEntityType;
  daily_task_id: string;
  task_step_id: string | null;
  task_steps_to_steps_id: string | null;
  assignee_employee_id: string;
  reject_reason: string | null;
}

/**
 * Fetch all rejected completions for an organization (for Job Desc / main table rejection display).
 */
export async function fetchRejectedForOrg(
  organizationId: string
): Promise<{ data: RejectedApprovalLookupRow[]; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('completion_approvals')
      .select('entity_type, daily_task_id, task_step_id, task_steps_to_steps_id, assignee_employee_id, reject_reason')
      .eq('organization_id', organizationId)
      .eq('status', 'rejected')
      .order('rejected_at', { ascending: false });
    if (error) return { data: [], error: new Error(error.message) };
    return { data: (data ?? []) as RejectedApprovalLookupRow[], error: null };
  } catch (e) {
    return { data: [], error: e instanceof Error ? e : new Error(String(e)) };
  }
}

/**
 * Fetch rejected completions for the current user as assignee (to show "Rejected by assigner").
 * Includes task/step/substep titles and assignee name for card display.
 */
export async function fetchRejectedForAssignee(
  organizationId: string,
  assigneeEmployeeId: string
): Promise<{ data: CompletionApprovalRow[]; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('completion_approvals')
      .select(REJECTED_SELECT)
      .eq('organization_id', organizationId)
      .eq('assignee_employee_id', assigneeEmployeeId)
      .eq('status', 'rejected')
      .order('rejected_at', { ascending: false })
      .limit(50);
    if (error) return { data: [], error: new Error(error.message) };
    return { data: (data ?? []) as CompletionApprovalRow[], error: null };
  } catch (e) {
    return { data: [], error: e instanceof Error ? e : new Error(String(e)) };
  }
}

/**
 * Approve a completion. No change to task/step/substep (already completed).
 */
export async function approveCompletion(
  approvalId: string,
  approvedByEmployeeId: string
): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase
      .from('completion_approvals')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString(),
        approved_by: approvedByEmployeeId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', approvalId)
      .eq('status', 'pending');
    return { error: error ? new Error(error.message) : null };
  } catch (e) {
    return { error: e instanceof Error ? e : new Error(String(e)) };
  }
}

/**
 * Reject a completion: update approval row, then uncheck the task/step/substep.
 */
export async function rejectCompletion(
  approvalId: string,
  rejectedByEmployeeId: string,
  rejectReason: string
): Promise<{ error: Error | null }> {
  try {
    const { data: row, error: fetchErr } = await supabase
      .from('completion_approvals')
      .select('id, entity_type, daily_task_id, task_step_id, task_steps_to_steps_id')
      .eq('id', approvalId)
      .eq('status', 'pending')
      .single();
    if (fetchErr || !row) return { error: new Error(fetchErr?.message ?? 'Approval not found') };

    const { error: updateErr } = await supabase
      .from('completion_approvals')
      .update({
        status: 'rejected',
        rejected_by: rejectedByEmployeeId,
        rejected_at: new Date().toISOString(),
        reject_reason: rejectReason.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', approvalId);
    if (updateErr) return { error: new Error(updateErr.message) };

    const entityType = row.entity_type as CompletionEntityType;
    if (entityType === 'task') {
      const { error: taskErr } = await supabase
        .from('daily_tasks')
        .update({ status: 'pending' })
        .eq('id', row.daily_task_id);
      if (taskErr) return { error: new Error(taskErr.message) };
    } else if (entityType === 'step') {
      const { error: stepErr } = await supabase
        .from('task_steps')
        .update({ is_completed: false, completed_at: null })
        .eq('id', row.task_step_id);
      if (stepErr) return { error: new Error(stepErr.message) };
    } else if (entityType === 'substep') {
      const { error: subErr } = await supabase
        .from('task_steps_to_steps')
        .update({ is_completed: false, completed_at: null })
        .eq('id', row.task_steps_to_steps_id);
      if (subErr) return { error: new Error(subErr.message) };
    }
    return { error: null };
  } catch (e) {
    return { error: e instanceof Error ? e : new Error(String(e)) };
  }
}

/**
 * task_steps.created_by references users.id; completion_approvals.assigner_employee_id must be employees.id.
 */
async function resolveAssignerEmployeeId(params: {
  organizationId: string;
  assignedByFromAssignment: string | null | undefined;
  stepCreatedBy: string | null | undefined;
}): Promise<{ employeeId: string | null; via: 'assignment' | 'created_by_employee' | 'created_by_user' | 'none' }> {
  const { organizationId, assignedByFromAssignment, stepCreatedBy } = params;
  if (assignedByFromAssignment) {
    return { employeeId: assignedByFromAssignment, via: 'assignment' };
  }
  if (!stepCreatedBy) return { employeeId: null, via: 'none' };

  const { data: asEmployee } = await supabase
    .from('employees')
    .select('id')
    .eq('id', stepCreatedBy)
    .eq('organization_id', organizationId)
    .maybeSingle();
  if (asEmployee?.id) return { employeeId: asEmployee.id, via: 'created_by_employee' };

  const { data: asUser } = await supabase
    .from('employees')
    .select('id')
    .eq('user_id', stepCreatedBy)
    .eq('organization_id', organizationId)
    .maybeSingle();
  if (asUser?.id) return { employeeId: asUser.id, via: 'created_by_user' };

  return { employeeId: null, via: 'none' };
}

/**
 * When Google Drive link is saved in Preview: mark the linked step complete and create a
 * pending completion_approval so assigner sees it in Task Summary (without assignee checking complete on Daily Task).
 * Prefers Content step (is_concept_step = false); falls back to Concept step. Updates daily_tasks.status from progress.
 */
export async function completeStepAndCreateApprovalFromDriveLink(params: {
  organizationId: string;
  socialMediaPlanId: string;
}): Promise<{ error: Error | null }> {
  const { organizationId, socialMediaPlanId } = params;
  try {
    // 1. Find step(s) linked to this plan; prefer Content step
    const { data: contentSteps, error: stepsErr } = await supabase
      .from('task_steps')
      .select('id, task_id, is_concept_step, created_by')
      .eq('social_media_plan_id', socialMediaPlanId)
      .eq('is_concept_step', false)
      .limit(1);
    if (stepsErr) return { error: new Error(stepsErr.message) };

    let stepRow: {
      id: string;
      task_id: string;
      is_concept_step: boolean;
      created_by?: string | null;
    } | null = contentSteps?.[0] ?? null;
    if (!stepRow) {
      const { data: conceptSteps, error: conceptErr } = await supabase
        .from('task_steps')
        .select('id, task_id, is_concept_step, created_by')
        .eq('social_media_plan_id', socialMediaPlanId)
        .eq('is_concept_step', true)
        .limit(1);
      if (conceptErr) return { error: new Error(conceptErr.message) };
      stepRow = conceptSteps?.[0] ?? null;
    }
    if (!stepRow) {
      return { error: null };
    }

    const stepId = stepRow.id;
    const taskId = stepRow.task_id;

    // If the step has sub-steps, do not force-complete it from drive link.
    // Completion must remain sub-step-driven; link only unlocks the last-substep completion.
    const { count: subCount, error: subCountErr } = await supabase
      .from('task_steps_to_steps')
      .select('*', { count: 'exact', head: true })
      .eq('parent_step_id', stepId);
    // If we can't read sub-step count due to RLS, don't block completion.
    // Only skip auto-complete when we can confidently detect sub-steps exist.
    if (!subCountErr && (subCount ?? 0) > 0) {
      return { error: null };
    }

    // 2. Mark step complete first (must not depend on assignment read permissions)
    const completedAt = new Date().toISOString();
    const { error: updateStepErr } = await supabase
      .from('task_steps')
      .update({ is_completed: true, completed_at: completedAt })
      .eq('id', stepId);
    if (updateStepErr) {
      return { error: new Error(updateStepErr.message) };
    }

    // 3. Get assignment for this step (assignee + assigner).
    // If RLS blocks this read, fallback to task_steps.assigned_to/created_by.
    const { data: assignment } = await supabase
      .from('task_steps_assigned')
      .select('employee_id, assigned_by')
      .eq('task_step_id', stepId)
      .order('assigned_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // assignee fallback: prefer assignment; if not readable, use plan PIC Production / PIC.
    let assigneeEmployeeId: string | null = assignment?.employee_id ?? null;
    if (!assigneeEmployeeId) {
      const { data: planAssignee, error: planAssigneeErr } = await supabase
        .from('social_media_plans')
        .select('pic_production_id, pic_id')
        .eq('id', socialMediaPlanId)
        .maybeSingle();
      if (!planAssigneeErr) {
        assigneeEmployeeId =
          (planAssignee as any)?.pic_production_id ??
          (planAssignee as any)?.pic_id ??
          null;
      }
    }
    const resolvedAssigner = await resolveAssignerEmployeeId({
      organizationId,
      assignedByFromAssignment: assignment?.assigned_by,
      stepCreatedBy: stepRow.created_by,
    });
    let assignerEmployeeId = resolvedAssigner.employeeId;
    if (!assignerEmployeeId) {
      const { data: planPic } = await supabase
        .from('social_media_plans')
        .select('pic_id')
        .eq('id', socialMediaPlanId)
        .maybeSingle();
      if (planPic?.pic_id) {
        assignerEmployeeId = planPic.pic_id;
      }
    }

    // 4. Create completion_approval only if we have assignee+assigner and no existing pending
    if (assigneeEmployeeId && assignerEmployeeId) {
      const { data: existingPendingRows, error: pendingErr } = await supabase
        .from('completion_approvals')
        .select('id')
        .eq('entity_type', 'step')
        .eq('task_step_id', stepId)
        .eq('status', 'pending')
        .limit(1);
      if (pendingErr) return { error: new Error(pendingErr.message) };

      if (!existingPendingRows || existingPendingRows.length === 0) {
        const { error: insertErr } = await supabase.from('completion_approvals').insert({
          organization_id: organizationId,
          entity_type: 'step',
          daily_task_id: taskId,
          task_step_id: stepId,
          assignee_employee_id: assigneeEmployeeId,
          assigner_employee_id: assignerEmployeeId,
          status: 'pending',
          completed_at: completedAt,
        });
        if (insertErr) {
          return { error: new Error(insertErr.message) };
        }
      }
    }

    // 5. Update daily_tasks.status from step progress
    const { data: allSteps, error: allStepsErr } = await supabase
      .from('task_steps')
      .select('is_completed')
      .eq('task_id', taskId);
    if (allStepsErr) return { error: new Error(allStepsErr.message) };
    if (allSteps && allSteps.length > 0) {
      const { data: currentTask, error: taskErr } = await supabase
        .from('daily_tasks')
        .select('status')
        .eq('id', taskId)
        .single();
      if (!taskErr && currentTask) {
        const currentStatus = (currentTask as { status?: string })?.status ?? 'pending';
        const progress = calculateProgress(allSteps as { is_completed: boolean }[], currentStatus);
        const finalStatus = determineStatusFromProgress(progress, currentStatus);
        await supabase
          .from('daily_tasks')
          .update({ status: finalStatus, updated_at: new Date().toISOString() })
          .eq('id', taskId);
      }
    }

    return { error: null };
  } catch (e) {
    return { error: e instanceof Error ? e : new Error(String(e)) };
  }
}

/**
 * When Google Drive link is removed in Preview: uncomplete the linked step and reject any pending
 * completion_approval for that step so it disappears from Task Summary.
 * Uses client-side updates; RLS may block approval update if caller is not the assigner.
 */
export async function revertStepCompletionFromDriveLinkRemoval(params: {
  organizationId: string;
  socialMediaPlanId: string;
  rejectedByEmployeeId?: string | null;
}): Promise<{ error: Error | null }> {
  const { organizationId, socialMediaPlanId, rejectedByEmployeeId } = params;
  const rejectedAt = new Date().toISOString();
  const rejectReason = LINK_REMOVED_FROM_PREVIEW_REJECT_REASON;

  try {
    // 1. Find step linked to this plan (same priority: Content then Concept)
    const { data: contentSteps, error: stepsErr } = await supabase
      .from('task_steps')
      .select('id, task_id')
      .eq('social_media_plan_id', socialMediaPlanId)
      .eq('is_concept_step', false)
      .limit(1);
    if (stepsErr) return { error: new Error(stepsErr.message) };

    let stepRow: { id: string; task_id: string } | null = contentSteps?.[0] ?? null;
    if (!stepRow) {
      const { data: conceptSteps, error: conceptErr } = await supabase
        .from('task_steps')
        .select('id, task_id')
        .eq('social_media_plan_id', socialMediaPlanId)
        .eq('is_concept_step', true)
        .limit(1);
      if (conceptErr) return { error: new Error(conceptErr.message) };
      stepRow = conceptSteps?.[0] ?? null;
    }
    if (!stepRow) return { error: null };

    const stepId = stepRow.id;
    const taskId = stepRow.task_id;

    // 2. Uncomplete the step
    const { error: updateStepErr } = await supabase
      .from('task_steps')
      .update({ is_completed: false, completed_at: null })
      .eq('id', stepId);
    if (updateStepErr) return { error: new Error(updateStepErr.message) };

    // 3. Reject any pending completion_approval for this step (so it disappears from Task Summary)
    const { data: pendingRows } = await supabase
      .from('completion_approvals')
      .select('id')
      .eq('entity_type', 'step')
      .eq('task_step_id', stepId)
      .eq('status', 'pending');
    if (pendingRows && pendingRows.length > 0) {
      const updatePayload: Record<string, unknown> = {
        status: 'rejected',
        rejected_by: rejectedByEmployeeId ?? null,
        rejected_at: rejectedAt,
        reject_reason: rejectReason,
        updated_at: rejectedAt,
      };
      for (const row of pendingRows) {
        const { error: updateApprovalErr } = await supabase
          .from('completion_approvals')
          .update(updatePayload)
          .eq('id', row.id);
        if (updateApprovalErr) return { error: new Error(updateApprovalErr.message) };
      }
    }

    // 4. Update daily_tasks.status from step progress
    const { data: allSteps, error: allStepsErr } = await supabase
      .from('task_steps')
      .select('is_completed')
      .eq('task_id', taskId);
    if (allStepsErr) return { error: new Error(allStepsErr.message) };
    if (allSteps && allSteps.length > 0) {
      const { data: currentTask, error: taskErr } = await supabase
        .from('daily_tasks')
        .select('status')
        .eq('id', taskId)
        .single();
      if (!taskErr && currentTask) {
        const currentStatus = (currentTask as { status?: string })?.status ?? 'pending';
        const progress = calculateProgress(allSteps as { is_completed: boolean }[], currentStatus);
        const finalStatus = determineStatusFromProgress(progress, currentStatus);
        await supabase
          .from('daily_tasks')
          .update({ status: finalStatus, updated_at: new Date().toISOString() })
          .eq('id', taskId);
      }
    }

    return { error: null };
  } catch (e) {
    return { error: e instanceof Error ? e : new Error(String(e)) };
  }
}

/**
 * Revert step completion and pending approval when link is removed. Tries RPC first (works for any
 * user); falls back to client-side revert if RPC is not available (e.g. migration not applied).
 */
export async function revertStepCompletionFromDriveLinkRemovalWithRpc(params: {
  organizationId: string;
  socialMediaPlanId: string;
  rejectedByEmployeeId?: string | null;
}): Promise<{ error: Error | null }> {
  const { organizationId, socialMediaPlanId, rejectedByEmployeeId } = params;
  try {
    const { data, error } = await supabase.rpc('revert_completion_on_drive_link_removal', {
      p_organization_id: organizationId,
      p_social_media_plan_id: socialMediaPlanId,
      p_rejected_by_employee_id: rejectedByEmployeeId ?? null,
    });
    if (!error) {
      const ok = (data as { ok?: boolean })?.ok;
      if (ok === false && (data as { error?: string })?.error) {
        return { error: new Error((data as { error: string }).error) };
      }
      return { error: null };
    }
    // RPC not found (42883) or other DB error: fall back to client-side revert
    if (error.code === '42883' || error.message?.includes('function') || error.message?.includes('does not exist')) {
      return revertStepCompletionFromDriveLinkRemoval(params);
    }
    return { error: new Error(error.message) };
  } catch (e) {
    return { error: e instanceof Error ? e : new Error(String(e)) };
  }
}

/**
 * Apply production_approved decision from Social Media Plan to linked step.
 * - approved = true  => step completed, pending approvals resolved as approved
 * - approved = false => step reopened, pending approvals resolved as rejected
 */
export async function syncStepCompletionFromProductionApproval(params: {
  organizationId: string;
  socialMediaPlanId: string;
  approved: boolean;
  actorEmployeeId?: string | null;
}): Promise<{ error: Error | null }> {
  const { socialMediaPlanId, approved, actorEmployeeId } = params;
  const nowIso = new Date().toISOString();
  try {
    // Find linked step (prefer Content step over Concept)
    const { data: contentSteps, error: contentErr } = await supabase
      .from('task_steps')
      .select('id, task_id')
      .eq('social_media_plan_id', socialMediaPlanId)
      .eq('is_concept_step', false)
      .limit(1);
    if (contentErr) return { error: new Error(contentErr.message) };

    let stepRow: { id: string; task_id: string } | null = contentSteps?.[0] ?? null;
    if (!stepRow) {
      const { data: conceptSteps, error: conceptErr } = await supabase
        .from('task_steps')
        .select('id, task_id')
        .eq('social_media_plan_id', socialMediaPlanId)
        .eq('is_concept_step', true)
        .limit(1);
      if (conceptErr) return { error: new Error(conceptErr.message) };
      stepRow = conceptSteps?.[0] ?? null;
    }
    if (!stepRow) return { error: null };

    const stepId = stepRow.id;
    const taskId = stepRow.task_id;

    const { error: stepErr } = await supabase
      .from('task_steps')
      .update({
        is_completed: approved,
        completed_at: approved ? nowIso : null,
      })
      .eq('id', stepId);
    if (stepErr) return { error: new Error(stepErr.message) };

    // Keep completion_approvals in sync:
    // - approved=true: resolve pending rows to approved
    // - approved=false: reopen the latest step approval as pending (or create one if missing)
    const { data: latestApproval } = await supabase
      .from('completion_approvals')
      .select('id, assignee_employee_id, assigner_employee_id, status')
      .eq('entity_type', 'step')
      .eq('task_step_id', stepId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (approved) {
      const { data: pendingApprovals } = await supabase
        .from('completion_approvals')
        .select('id')
        .eq('entity_type', 'step')
        .eq('task_step_id', stepId)
        .eq('status', 'pending');
      if (pendingApprovals && pendingApprovals.length > 0) {
        for (const row of pendingApprovals) {
          const { error: approvalErr } = await supabase
            .from('completion_approvals')
            .update({
              status: 'approved',
              approved_at: nowIso,
              approved_by: actorEmployeeId ?? null,
              updated_at: nowIso,
            })
            .eq('id', row.id);
          if (approvalErr) return { error: new Error(approvalErr.message) };
        }
      }
      // If the latest row is still rejected (no pending row), align with Prod Approved on the plan.
      const { data: latestAfterPending } = await supabase
        .from('completion_approvals')
        .select('id, status')
        .eq('entity_type', 'step')
        .eq('task_step_id', stepId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (latestAfterPending?.id && latestAfterPending.status !== 'approved') {
        const { error: resolveErr } = await supabase
          .from('completion_approvals')
          .update({
            status: 'approved',
            approved_at: nowIso,
            approved_by: actorEmployeeId ?? null,
            rejected_at: null,
            reject_reason: null,
            updated_at: nowIso,
          })
          .eq('id', latestAfterPending.id);
        if (resolveErr) return { error: new Error(resolveErr.message) };
      }
    } else {
      if (latestApproval?.id) {
        const { error: reopenApprovalErr } = await supabase
          .from('completion_approvals')
          .update({
            status: 'pending',
            approved_at: null,
            approved_by: null,
            rejected_at: null,
            reject_reason: null,
            updated_at: nowIso,
          })
          .eq('id', latestApproval.id);
        if (reopenApprovalErr) return { error: new Error(reopenApprovalErr.message) };
      } else {
        // Fallback: create pending approval from latest assignment if no approval row exists yet.
        const { data: assignment, error: assignErr } = await supabase
          .from('task_steps_assigned')
          .select('employee_id, assigned_by')
          .eq('task_step_id', stepId)
          .order('assigned_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (assignErr) return { error: new Error(assignErr.message) };
        if (assignment?.employee_id && assignment?.assigned_by) {
          const { error: insertErr } = await supabase.from('completion_approvals').insert({
            organization_id: params.organizationId,
            entity_type: 'step',
            daily_task_id: taskId,
            task_step_id: stepId,
            assignee_employee_id: assignment.employee_id,
            assigner_employee_id: assignment.assigned_by,
            status: 'pending',
            completed_at: nowIso,
          });
          if (insertErr) return { error: new Error(insertErr.message) };
        }
      }
    }

    // Keep task status derived from steps.
    const { data: allSteps, error: allStepsErr } = await supabase
      .from('task_steps')
      .select('is_completed')
      .eq('task_id', taskId);
    if (allStepsErr) return { error: new Error(allStepsErr.message) };
    if (allSteps && allSteps.length > 0) {
      const { data: currentTask, error: taskErr } = await supabase
        .from('daily_tasks')
        .select('status')
        .eq('id', taskId)
        .single();
      if (!taskErr && currentTask) {
        const currentStatus = (currentTask as { status?: string })?.status ?? 'pending';
        const progress = calculateProgress(allSteps as { is_completed: boolean }[], currentStatus);
        const finalStatus = determineStatusFromProgress(progress, currentStatus);
        await supabase
          .from('daily_tasks')
          .update({ status: finalStatus, updated_at: new Date().toISOString() })
          .eq('id', taskId);
      }
    }

    return { error: null };
  } catch (e) {
    return { error: e instanceof Error ? e : new Error(String(e)) };
  }
}
