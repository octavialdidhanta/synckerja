import { isFileLink } from '@/6-1-dashboard/utils/previewUtils';

export type PlanAutoScheduleEligibilityInput = {
  post_date: string | null | undefined;
  approved: boolean | null | undefined;
  production_approved: boolean | null | undefined;
  google_drive_link: string | null | undefined;
  content_type_name: string | null | undefined;
  service_id: string | null | undefined;
};

export type PlanPublishEligibilityOptions = {
  ownerBypass?: boolean;
};

function isReelContentType(contentTypeName: string | null | undefined): boolean {
  return String(contentTypeName ?? '').trim().toLowerCase() === 'reel';
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
