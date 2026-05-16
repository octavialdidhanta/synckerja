export const MIN_SURVEY_RESPONSES_FOR_STATUS = 3;

export const DEFAULT_ORG_PROMOTER_PCT_TARGET = 80;

export type SurveyPromoterStatusKind = "achieve" | "failed" | "insufficient_data" | "no_target";

export function computeSurveyPromoterStatus(
  responseCount: number,
  promoterPct: number,
  targetPct: number | null | undefined,
): SurveyPromoterStatusKind {
  if (targetPct == null || Number.isNaN(targetPct)) {
    return "no_target";
  }
  if (responseCount < MIN_SURVEY_RESPONSES_FOR_STATUS) {
    return "insufficient_data";
  }
  if (promoterPct >= targetPct) {
    return "achieve";
  }
  return "failed";
}
