import type { StepCommentWriteContext } from '../types';

export function canWriteStepComment(ctx: StepCommentWriteContext): boolean {
  const {
    taskCreatedBy,
    taskAssignedTo,
    stepAssignedTo,
    hasCommented,
    currentUserId,
    currentEmployeeId,
  } = ctx;
  if (!currentUserId) return false;
  if (taskCreatedBy && taskCreatedBy === currentUserId) return true;
  if (currentEmployeeId && taskAssignedTo && taskAssignedTo === currentEmployeeId) return true;
  if (currentEmployeeId && stepAssignedTo && stepAssignedTo === currentEmployeeId) return true;
  if (hasCommented) return true;
  return false;
}
