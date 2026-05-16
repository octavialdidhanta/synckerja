import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DEFAULT_ORG_PROMOTER_PCT_TARGET } from "@/features/customer-survey/core/surveyPromoterTarget";
import { supabase } from "@/shared/lib/supabaseClient";

export const customerSurveyOrgTargetQueryKey = (organizationId: string | null | undefined) =>
  ["organization-customer-survey-org-target", organizationId] as const;

export function useCustomerSurveyOrgTarget(organizationId: string | null | undefined) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: customerSurveyOrgTargetQueryKey(organizationId),
    enabled: Boolean(organizationId),
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase
        .from("organization_customer_survey_settings")
        .select("promoter_pct_target")
        .eq("organization_id", organizationId as string)
        .maybeSingle();
      if (error) throw error;
      const v = data?.promoter_pct_target;
      if (v == null) return DEFAULT_ORG_PROMOTER_PCT_TARGET;
      return Number(v);
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (targetPct: number) => {
      if (targetPct < 0 || targetPct > 100) {
        throw new Error("invalid_target");
      }
      const oid = organizationId as string;
      const { error } = await supabase.from("organization_customer_survey_settings").upsert(
        {
          organization_id: oid,
          promoter_pct_target: Math.round(targetPct * 100) / 100,
        },
        { onConflict: "organization_id" },
      );
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: customerSurveyOrgTargetQueryKey(organizationId) });
      await qc.invalidateQueries({ queryKey: ["crm-customer-survey-summary"] });
    },
  });

  return {
    ...query,
    targetPct: query.data ?? DEFAULT_ORG_PROMOTER_PCT_TARGET,
    saveMutation,
  };
}
