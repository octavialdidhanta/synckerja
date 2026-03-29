export interface StepCheckboxRuleResult {
  hasSubSteps: boolean;
  isSubStepProgressFull: boolean;
  isChecked: boolean;
  isDisabled: boolean;
  reasonKey: 'completeAllSubStepsFirst' | 'cannotUncheckStepWithSubSteps' | null;
}

/**
 * Shared rule for step checkbox behavior.
 * Steps with sub-steps are driven by sub-step progress and cannot be toggled manually.
 */
export function getStepCheckboxRule(params: {
  isCompleted: boolean;
  subStepCount: number;
  subStepCompletedCount: number;
}): StepCheckboxRuleResult {
  const { isCompleted, subStepCount, subStepCompletedCount } = params;
  const hasSubSteps = subStepCount > 0;

  if (!hasSubSteps) {
    return {
      hasSubSteps: false,
      isSubStepProgressFull: isCompleted,
      isChecked: isCompleted,
      isDisabled: false,
      reasonKey: null,
    };
  }

  const isSubStepProgressFull = subStepCompletedCount >= subStepCount;
  return {
    hasSubSteps: true,
    isSubStepProgressFull,
    isChecked: isSubStepProgressFull,
    isDisabled: true,
    reasonKey: isSubStepProgressFull
      ? 'cannotUncheckStepWithSubSteps'
      : 'completeAllSubStepsFirst',
  };
}
