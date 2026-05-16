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
