import type {
  DmReportTargetAccountAssignment,
  DmReportTargetFormValue,
} from "@/6-0-digital-marketing-shared/dmReportTargetTypes";

export function requiresCompanyObjectiveForDmSave(
  values: DmReportTargetFormValue[],
  assignments: DmReportTargetAccountAssignment[],
): boolean {
  const hasTargets = values.some((v) => v.targetValue > 0);
  const hasAssignments = assignments.length > 0;
  return hasTargets || hasAssignments;
}
