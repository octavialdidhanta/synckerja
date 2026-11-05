import { isFileLink } from '@/6-1-dashboard/utils/previewUtils';

export const CAROUSEL_PUBLISH_IMAGE_LIMIT = 10;

export type PlanAutoScheduleEligibilityInput = {
  post_date: string | null | undefined;
  approved: boolean | null | undefined;
  production_approved: boolean | null | undefined;
  google_drive_link: string | null | undefined;
  content_type_name: string | null | undefined;
  service_id: string | null | undefined;
  carousel_image_count?: number | null;
};

export type PlanPublishEligibilityOptions = {
  ownerBypass?: boolean;
};

function isReelContentType(contentTypeName: string | null | undefined): boolean {
  return String(contentTypeName ?? '').trim().toLowerCase() === 'reel';
}

export function isCarouselContentType(contentTypeName: string | null | undefined): boolean {
  const name = String(contentTypeName ?? '').trim().toLowerCase();
  return name === 'post' || name === 'carousel';
}

export function getTikTokCarouselPublishMissing(plan: PlanAutoScheduleEligibilityInput): string[] {
  const missing: string[] = [];
  if (!plan.post_date) missing.push('post_date');
  if (!isCarouselContentType(plan.content_type_name)) missing.push('content_type_carousel');
  if (!plan.approved) missing.push('approved');
  if (!plan.production_approved) missing.push('production_approved');
  const count = plan.carousel_image_count ?? 0;
  if (count < 1) missing.push('carousel_images');
  else if (count > CAROUSEL_PUBLISH_IMAGE_LIMIT) missing.push('carousel_image_limit');
  return missing;
}

export function isTikTokCarouselPublishReady(plan: PlanAutoScheduleEligibilityInput): boolean {
  return getTikTokCarouselPublishMissing(plan).length === 0;
}

export function getPlanPublishEligibilityMissing(
  plan: PlanAutoScheduleEligibilityInput,
  options?: PlanPublishEligibilityOptions,
): string[] {
  const ownerBypass = options?.ownerBypass === true;
  const missing: string[] = [];

  if (!plan.post_date) missing.push('post_date');
  if (!ownerBypass && !plan.approved) missing.push('approved');
  if (!ownerBypass && !plan.production_approved) missing.push('production_approved');
  if (!isReelContentType(plan.content_type_name)) missing.push('content_type_reel');

  const link = plan.google_drive_link?.trim() ?? '';
  if (!link) {
    missing.push('google_drive_link');
  } else if (!isFileLink(link)) {
    missing.push('google_drive_file');
  }

  if (!String(plan.service_id ?? '').trim()) missing.push('service_id');

  return missing;
}

export function isPlanEligibleForPublish(
  plan: PlanAutoScheduleEligibilityInput,
  options?: PlanPublishEligibilityOptions,
): boolean {
  return getPlanPublishEligibilityMissing(plan, options).length === 0;
}

export function isPlanEligibleForAutoSchedule(plan: PlanAutoScheduleEligibilityInput): boolean {
  return isPlanEligibleForPublish(plan);
}
