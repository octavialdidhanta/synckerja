import type { LatestCustomerSurvey } from "@/features/customer-survey/hooks/useCustomerSurveyForLeads";
import { isWhatsappLeadForSurvey } from "@/features/customer-survey/core/resolveWhatsappConversationId";
import type { NewLead } from "@/shared/types/leads";

export type SurveyRatingFilterValue = "all" | "none" | "1" | "2" | "3" | "4" | "5";

export const SURVEY_RATING_FILTER_OPTIONS: SurveyRatingFilterValue[] = [
  "none",
  "1",
  "2",
  "3",
  "4",
  "5",
];

export function matchesLeadSurveyRatingFilter(
  lead: NewLead,
  filter: SurveyRatingFilterValue,
  getSurveyForLead: (lead: NewLead) => LatestCustomerSurvey | null,
): boolean {
  if (filter === "all") return true;
  if (!isWhatsappLeadForSurvey(lead)) return false;
  const latest = getSurveyForLead(lead);
  if (filter === "none") return latest == null;
  return latest != null && latest.rating === Number(filter);
}

/** Numeric rating for table sort (null = no survey / not applicable → sorts last). */
export function getLeadSurveyRatingSortValue(
  lead: NewLead,
  getSurveyForLead: (lead: NewLead) => LatestCustomerSurvey | null,
): number | null {
  if (!isWhatsappLeadForSurvey(lead)) return null;
  const latest = getSurveyForLead(lead);
  if (latest == null || !Number.isFinite(latest.rating)) return null;
  return latest.rating;
}

/** Precompute ratings for every visible lead so sort uses the same source as the Rating column. */
export function buildSurveyRatingSortByLeadId(
  leads: ReadonlyArray<NewLead>,
  getSurveyForLead: (lead: NewLead) => LatestCustomerSurvey | null,
): Map<string, number | null> {
  const map = new Map<string, number | null>();
  for (const lead of leads) {
    map.set(String(lead.id ?? ""), getLeadSurveyRatingSortValue(lead, getSurveyForLead));
  }
  return map;
}
