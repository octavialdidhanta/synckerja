export type StoryPlanEligibilityInput = {
  post_date: string | null;
  approved: boolean;
  production_approved: boolean;
  content_type_name: string | null;
  /** Storage path in bucket social-media-story (canva_story_runs.export_path). */
  export_path?: string | null;
};

export function isStoryContentType(contentTypeName: string | null | undefined): boolean {
  return String(contentTypeName ?? "").trim().toLowerCase() === "story";
}

export function getStoryPlanEligibilityMissingReasons(plan: StoryPlanEligibilityInput): string[] {
  const reasons: string[] = [];
  if (!isStoryContentType(plan.content_type_name)) reasons.push("content_type_story");
  if (!plan.post_date) reasons.push("post_date");
  if (!plan.approved) reasons.push("approved");
  if (!plan.production_approved) reasons.push("production_approved");
  if (!String(plan.export_path ?? "").trim()) reasons.push("story_export");
  return reasons;
}

export function isPlanEligibleForInstagramStorySchedule(plan: StoryPlanEligibilityInput): boolean {
  return getStoryPlanEligibilityMissingReasons(plan).length === 0;
}
