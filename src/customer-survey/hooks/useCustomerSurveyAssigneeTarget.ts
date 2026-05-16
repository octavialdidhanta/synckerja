import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";

export function useCustomerSurveyAssigneeTargetMutations(organizationId: string | null | undefined) {
  const qc = useQueryClient();

  const invalidateSummary = async () => {
    await qc.invalidateQueries({ queryKey: ["crm-customer-survey-summary"] });
  };

  const upsertMutation = useMutation({
    mutationFn: async ({
      assigneeId,
      targetPct,
    }: {
      assigneeId: string;
      targetPct: number;
    }) => {
      if (!organizationId) throw new Error("no_org");
      const { error } = await supabase.rpc("upsert_customer_survey_assignee_target", {
        p_organization_id: organizationId,
        p_assignee_id: assigneeId,
        p_target_pct: targetPct,
      });
      if (error) throw error;
    },
    onSuccess: invalidateSummary,
  });

  const clearMutation = useMutation({
    mutationFn: async (assigneeId: string) => {
      if (!organizationId) throw new Error("no_org");
      const { error } = await supabase.rpc("clear_customer_survey_assignee_target", {
        p_organization_id: organizationId,
        p_assignee_id: assigneeId,
      });
      if (error) throw error;
    },
    onSuccess: invalidateSummary,
  });

  return { upsertMutation, clearMutation };
}
