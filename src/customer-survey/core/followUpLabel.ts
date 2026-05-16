import type { FollowUpMode } from "@/features/customer-survey/core/surveySettingsDefaults";

export type FollowUpFields = {
  follow_up_single?: string | null;
  follow_up_low?: string | null;
  follow_up_mid?: string | null;
  follow_up_high?: string | null;
};

/** Label shown above optional comment for CES follow-up (derived from org settings + rating). */
export function deriveFollowUpQuestionLabel(
  mode: FollowUpMode,
  rating: number | null,
  f: FollowUpFields,
): string | null {
  if (mode === "none" || rating == null) return null;
  if (mode === "single") {
    const s = (f.follow_up_single ?? "").trim();
    return s.length ? s : null;
  }
  if (mode === "by_score") {
    if (rating <= 2) {
      const s = (f.follow_up_low ?? "").trim();
      return s.length ? s : null;
    }
    if (rating === 3) {
      const s = (f.follow_up_mid ?? "").trim();
      return s.length ? s : null;
    }
    const s = (f.follow_up_high ?? "").trim();
    return s.length ? s : null;
  }
  return null;
}
