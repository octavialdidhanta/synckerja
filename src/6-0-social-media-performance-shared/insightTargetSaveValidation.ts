import type {
  InsightTargetAccountAssignment,
  InsightTargetFormValue,
} from "@/6-0-social-media-performance-shared/socialMediaInsightTargetTypes";

/** True when save must include a Company Objective (targets or PIC assignments present). */
export function requiresCompanyObjectiveForSave(
  values: InsightTargetFormValue[],
  assignments: InsightTargetAccountAssignment[],
): boolean {
  const hasTargets = values.some((v) => v.targetValue > 0);
  const hasAssignments = assignments.length > 0;
  return hasTargets || hasAssignments;
}

/** @deprecated Use requiresCompanyObjectiveForSave */
export const requiresDepartmentObjectiveForSave = requiresCompanyObjectiveForSave;
