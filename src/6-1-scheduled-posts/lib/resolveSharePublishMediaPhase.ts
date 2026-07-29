import type { PlanAutoScheduleEligibilityInput } from './planAutoScheduleEligibility';
import { validateGoogleDriveVideoLink } from './validateGoogleDriveVideoLink';

export type SharePublishMediaPhase = 'pick' | 'publish';

export type SharePublishMediaPhaseState = {
  phase: SharePublishMediaPhase;
  attached: boolean;
  canSkipUpload: boolean;
};

export function planHasPublishableDriveLink(
  plan: Pick<PlanAutoScheduleEligibilityInput, 'google_drive_link'>,
): boolean {
  return validateGoogleDriveVideoLink(plan.google_drive_link).valid;
}

/**
 * Resolve initial media step when a plan is selected in Share-to-Publish.
 * If the plan already has a publishable Drive file link, skip upload and enter publish phase.
 */
export function resolveSharePublishMediaPhase(
  plan: Pick<PlanAutoScheduleEligibilityInput, 'google_drive_link'>,
  hasSharedVideo: boolean,
): SharePublishMediaPhaseState {
  const canSkipUpload = planHasPublishableDriveLink(plan);

  if (canSkipUpload) {
    return {
      phase: 'publish',
      attached: true,
      canSkipUpload: true,
    };
  }

  return {
    phase: 'pick',
    attached: false,
    canSkipUpload: false,
  };
}
