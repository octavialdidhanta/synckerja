import { googleDriveLinksSemanticallyEqual, isGoogleDriveFileLink } from "./googleDrivePublicVideoUrl.ts";

export type PlanEligibilityInput = {
  post_date: string | null;
  approved: boolean;
  production_approved: boolean;
  google_drive_link: string | null;
  content_type_name: string | null;
};

export function isReelContentType(contentTypeName: string | null | undefined): boolean {
  return String(contentTypeName ?? "").trim().toLowerCase() === "reel";
}

export function isPlanEligibleForTikTokAutoSchedule(plan: PlanEligibilityInput): boolean {
  if (!plan.post_date) return false;
  if (!plan.approved) return false;
  if (!plan.production_approved) return false;
  if (!isReelContentType(plan.content_type_name)) return false;
  const link = plan.google_drive_link?.trim() ?? "";
  if (!link) return false;
  if (!isGoogleDriveFileLink(link)) return false;
  return true;
}

export function getPlanEligibilityMissingReasons(plan: PlanEligibilityInput): string[] {
  const reasons: string[] = [];
  if (!plan.post_date) reasons.push("post_date");
  if (!isReelContentType(plan.content_type_name)) reasons.push("content_type_reel");
  if (!plan.approved) reasons.push("approved");
  if (!plan.production_approved) reasons.push("production_approved");
  const link = plan.google_drive_link?.trim() ?? "";
  if (!link) reasons.push("google_drive_link");
  else if (!isGoogleDriveFileLink(link)) reasons.push("google_drive_file");
  return reasons;
}

export function shouldCancelScheduleDueToDriveMismatch(
  snapshot: string,
  currentLink: string | null | undefined,
): boolean {
  return !googleDriveLinksSemanticallyEqual(snapshot, currentLink);
}
