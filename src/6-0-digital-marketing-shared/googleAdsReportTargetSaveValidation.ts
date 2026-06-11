import type {
  GoogleAdsReportTargetAccountAssignment,
  GoogleAdsReportTargetFormValue,
} from "@/6-0-digital-marketing-shared/googleAdsReportTargetTypes";

export function requiresCompanyObjectiveForGoogleAdsSave(
  values: GoogleAdsReportTargetFormValue[],
  assignments: GoogleAdsReportTargetAccountAssignment[],
): boolean {
  const hasTargets = values.some((v) => v.targetValue > 0);
  const hasAssignments = assignments.length > 0;
  return hasTargets || hasAssignments;
}
