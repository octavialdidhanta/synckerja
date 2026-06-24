import { isFileLink } from '@/6-1-dashboard/utils/previewUtils';

export type PlanAutoScheduleEligibilityInput = {
  post_date: string | null | undefined;
  approved: boolean | null | undefined;
  production_approved: boolean | null | undefined;
  google_drive_link: string | null | undefined;
  content_type_name: string | null | undefined;
  service_id: string | null | undefined;
};

function isReelContentType(contentTypeName: string | null | undefined): boolean {
  return String(contentTypeName ?? '').trim().toLowerCase() === 'reel';
}

export function isPlanEligibleForAutoSchedule(plan: PlanAutoScheduleEligibilityInput): boolean {
  if (!plan.post_date) return false;
  if (!plan.approved) return false;
  if (!plan.production_approved) return false;
  if (!isReelContentType(plan.content_type_name)) return false;
  const link = plan.google_drive_link?.trim() ?? '';
  if (!link || !isFileLink(link)) return false;
  if (!String(plan.service_id ?? '').trim()) return false;
  return true;
}
