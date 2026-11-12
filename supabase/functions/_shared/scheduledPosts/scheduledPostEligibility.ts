import { CAROUSEL_PUBLISH_IMAGE_LIMIT } from "../tiktokCarouselImageUrl.ts";
import { googleDriveLinksSemanticallyEqual, isGoogleDriveFileLink } from "./googleDrivePublicVideoUrl.ts";

export type PlanEligibilityInput = {
  post_date: string | null;
  approved: boolean;
  production_approved: boolean;
  google_drive_link: string | null;
  content_type_name: string | null;
  /** Set for TikTok photo carousel. Reel checks ignore it. */
  carousel_image_count?: number | null;
};

export type PlanAutoScheduleEligibilityInput = PlanEligibilityInput & {
  service_id: string | null;
};

export function isReelContentType(contentTypeName: string | null | undefined): boolean {
  return String(contentTypeName ?? "").trim().toLowerCase() === "reel";
}

export function isCarouselContentType(contentTypeName: string | null | undefined): boolean {
  const name = String(contentTypeName ?? "").trim().toLowerCase();
  return name === "post" || name === "carousel";
}

export function getTikTokPlanEligibilityMissingReasons(plan: PlanEligibilityInput): string[] {
  if (!isCarouselContentType(plan.content_type_name)) {
    return getPlanEligibilityMissingReasons(plan);
  }
  const reasons: string[] = [];
  if (!plan.post_date) reasons.push("post_date");
  if (!plan.approved) reasons.push("approved");
  if (!plan.production_approved) reasons.push("production_approved");
  const count = plan.carousel_image_count ?? 0;
  if (count < 1) reasons.push("carousel_images");
  else if (count > CAROUSEL_PUBLISH_IMAGE_LIMIT) reasons.push("carousel_image_limit");
  return reasons;
}

export function isPlanEligibleForTikTokCarouselSchedule(plan: PlanEligibilityInput): boolean {
  return isCarouselContentType(plan.content_type_name) &&
    getTikTokPlanEligibilityMissingReasons(plan).length === 0;
}

export function isPlanEligibleForTikTokAutoSchedule(plan: PlanEligibilityInput): boolean {
  if (isCarouselContentType(plan.content_type_name)) {
    return isPlanEligibleForTikTokCarouselSchedule(plan);
  }
  return isPlanEligibleForReelAutoSchedule(plan);
}

export function isPlanEligibleForYouTubeAutoSchedule(plan: PlanEligibilityInput): boolean {
  return isPlanEligibleForReelAutoSchedule(plan);
}

export function getInstagramPlanEligibilityMissingReasons(plan: PlanEligibilityInput): string[] {
  if (!isCarouselContentType(plan.content_type_name)) {
    return getPlanEligibilityMissingReasons(plan);
  }
  return getTikTokPlanEligibilityMissingReasons(plan);
}

export function isPlanEligibleForInstagramAutoSchedule(plan: PlanEligibilityInput): boolean {
  if (isCarouselContentType(plan.content_type_name)) {
    return isPlanEligibleForTikTokCarouselSchedule(plan);
  }
  return isPlanEligibleForReelAutoSchedule(plan);
}

export function getFacebookPlanEligibilityMissingReasons(plan: PlanEligibilityInput): string[] {
  if (!isCarouselContentType(plan.content_type_name)) {
    return getPlanEligibilityMissingReasons(plan);
  }
  return getTikTokPlanEligibilityMissingReasons(plan);
}

export function isPlanEligibleForFacebookAutoSchedule(plan: PlanEligibilityInput): boolean {
  if (isCarouselContentType(plan.content_type_name)) {
    return isPlanEligibleForTikTokCarouselSchedule(plan);
  }
  return isPlanEligibleForReelAutoSchedule(plan);
}

export function isPlanEligibleForLinkedInAutoSchedule(plan: PlanEligibilityInput): boolean {
  return isPlanEligibleForReelAutoSchedule(plan);
}

export function isPlanEligibleForReelAutoSchedule(plan: PlanEligibilityInput): boolean {
  if (!plan.post_date) return false;
  if (!plan.approved) return false;
  if (!plan.production_approved) return false;
  if (!isReelContentType(plan.content_type_name)) return false;
  const link = plan.google_drive_link?.trim() ?? "";
  if (!link) return false;
  if (!isGoogleDriveFileLink(link)) return false;
  return true;
}

export function isPlanEligibleForAutoSchedule(plan: PlanAutoScheduleEligibilityInput): boolean {
  if (!isPlanEligibleForReelAutoSchedule(plan)) return false;
  if (!String(plan.service_id ?? "").trim()) return false;
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
