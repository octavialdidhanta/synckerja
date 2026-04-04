import type { ContentPlan } from '../types/social-media';
import { isFolderLink, linksSemanticallyEqual } from './previewUtils';

export type PlanForDriveLinkPolicy = Pick<
  ContentPlan,
  | 'google_drive_link'
  | 'production_status'
  | 'production_revision_baseline_link'
  | 'pic_production_id'
  | 'pic_production_source'
>;

/**
 * Builds social_media_plans patch when saving a non-empty google_drive_link.
 * Request Revision: only promotes to Need Review when link differs from baseline (non-folder same URL uses explicit resubmit in modal for folders).
 */
export function getGoogleDriveLinkNonEmptyUpdates(
  plan: PlanForDriveLinkPolicy | undefined,
  linkStr: string,
  currentEmployeeId: string | undefined
): Partial<ContentPlan> {
  const completionDate = new Date().toISOString();
  const linkWithNeedReview: Partial<ContentPlan> = {
    google_drive_link: linkStr,
    production_status: 'Need Review',
    production_completion_date: completionDate,
    production_revision_baseline_link: null,
  };

  if (plan?.production_status === 'Request Revision') {
    const baseline =
      plan.production_revision_baseline_link?.trim() ||
      plan.google_drive_link?.trim() ||
      '';

    if (isFolderLink(linkStr) && linksSemanticallyEqual(linkStr, baseline)) {
      if (plan.google_drive_link?.trim() === linkStr) {
        return {};
      }
      return { google_drive_link: linkStr };
    }

    if (!linksSemanticallyEqual(linkStr, baseline)) {
      if (plan.pic_production_source === 'task_steps_assigned') {
        return { ...linkWithNeedReview };
      }
      if (!currentEmployeeId) {
        return { ...linkWithNeedReview };
      }
      return {
        ...linkWithNeedReview,
        pic_production_id: currentEmployeeId,
        pic_production_source: 'google_drive_link',
      };
    }

    if (plan.google_drive_link?.trim() === linkStr) {
      return {};
    }
    return { google_drive_link: linkStr };
  }

  if (plan?.pic_production_source === 'task_steps_assigned') {
    return { ...linkWithNeedReview };
  }
  if (!currentEmployeeId) {
    return { ...linkWithNeedReview };
  }
  return {
    ...linkWithNeedReview,
    pic_production_id: currentEmployeeId,
    pic_production_source: 'google_drive_link',
  };
}

/** User confirms revised content is ready (e.g. same folder URL); promotes to Need Review. */
export function getProductionResubmitAfterRevisionUpdates(): Partial<ContentPlan> {
  return {
    production_status: 'Need Review',
    production_completion_date: new Date().toISOString(),
    production_revision_baseline_link: null,
  };
}
