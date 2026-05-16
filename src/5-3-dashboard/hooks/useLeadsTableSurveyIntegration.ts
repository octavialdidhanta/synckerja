import { useCallback, useMemo, useState } from "react";
import type { NewLead } from "@/shared/types/leads";
import { matchesLeadSurveyRatingFilter } from "@/features/customer-survey/core/surveyRatingFilter";
import { useCustomerSurveyForLeads } from "@/features/customer-survey/hooks/useCustomerSurveyForLeads";
import type { SurveyRatingColumnFilterValue } from "@/5-3-dashboard/components/leads/table/LeadsTableNew";

/** Shared survey column state + RPC lookup for LeadsTableNew on leads management routes. */
export function useLeadsTableSurveyIntegration(
  organizationId: string | null | undefined,
  leads: NewLead[],
) {
  const [surveyRatingFilter, setSurveyRatingFilter] = useState<SurveyRatingColumnFilterValue>("all");
  const [surveyHistoryLead, setSurveyHistoryLead] = useState<NewLead | null>(null);
  const [surveyHistoryOpen, setSurveyHistoryOpen] = useState(false);

  const { getSurveyForLead, resolveConversationId, refetch: refetchSurvey } =
    useCustomerSurveyForLeads(organizationId, leads);

  const handleSurveyRatingFilterChange = useCallback((value: SurveyRatingColumnFilterValue) => {
    setSurveyRatingFilter(value);
  }, []);

  const handleOpenSurveyHistory = useCallback((lead: NewLead) => {
    setSurveyHistoryLead(lead);
    setSurveyHistoryOpen(true);
  }, []);

  const closeSurveyHistory = useCallback(() => {
    setSurveyHistoryOpen(false);
    setSurveyHistoryLead(null);
  }, []);

  const matchesSurveyRatingFilter = useCallback(
    (lead: NewLead) => matchesLeadSurveyRatingFilter(lead, surveyRatingFilter, getSurveyForLead),
    [surveyRatingFilter, getSurveyForLead],
  );

  const surveyTableProps = useMemo(
    () => ({
      getSurveyForLead,
      onOpenSurveyHistory: handleOpenSurveyHistory,
      surveyColumnFilter: {
        value: surveyRatingFilter,
        onChange: handleSurveyRatingFilterChange,
      },
    }),
    [
      getSurveyForLead,
      handleOpenSurveyHistory,
      surveyRatingFilter,
      handleSurveyRatingFilterChange,
    ],
  );

  const surveyHistoryDialogProps = useMemo(
    () =>
      surveyHistoryLead
        ? {
            open: surveyHistoryOpen,
            onClose: closeSurveyHistory,
            conversationId: resolveConversationId(surveyHistoryLead),
            leadTitle: surveyHistoryLead.title || surveyHistoryLead.client || "",
          }
        : null,
    [surveyHistoryLead, surveyHistoryOpen, closeSurveyHistory, resolveConversationId],
  );

  const refreshSurveyData = useCallback(() => {
    void refetchSurvey();
  }, [refetchSurvey]);

  return {
    surveyTableProps,
    matchesSurveyRatingFilter,
    surveyHistoryDialogProps,
    refreshSurveyData,
  };
}
