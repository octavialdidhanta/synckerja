/**
 * Signals that a "heavy" social plan modal is open. useRealtimeSocialMedia skips
 * full-table refetch on postgres_changes for social_media_plans while any of these
 * are set — otherwise refetch remounts rows and closes/wipes Preview, Brief, Title UX.
 */
const briefModalPlanId: { current: string | null } = { current: null };
const googleDriveModalPlanId: { current: string | null } = { current: null };
const titleModalPlanId: { current: string | null } = { current: null };

export function getBriefModalOpenPlanId(): string | null {
  return briefModalPlanId.current;
}

export function setBriefModalOpenPlanId(planId: string | null): void {
  briefModalPlanId.current = planId;
}

export function setGoogleDriveModalOpenPlanId(planId: string | null): void {
  googleDriveModalPlanId.current = planId;
}

export function setTitleModalOpenPlanId(planId: string | null): void {
  titleModalPlanId.current = planId;
}

/** When true, defer full `social-media-plans` refetch from realtime (modal stability). */
export function shouldDeferSocialMediaPlansRefetch(): boolean {
  return (
    briefModalPlanId.current != null ||
    googleDriveModalPlanId.current != null ||
    titleModalPlanId.current != null
  );
}
