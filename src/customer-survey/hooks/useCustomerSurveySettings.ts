import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  customerSurveySettingsSchema,
  defaultCustomerSurveySettings,
  type CustomerSurveySettingsFormValues,
} from "@/features/customer-survey/core/surveySettingsDefaults";
import { supabase } from "@/shared/lib/supabaseClient";

export const customerSurveySettingsQueryKey = (organizationId: string | null | undefined) =>
  ["organization-customer-survey-settings", organizationId] as const;

function rowToForm(orgId: string, row: Record<string, unknown> | null): CustomerSurveySettingsFormValues {
  const base = defaultCustomerSurveySettings(orgId);
  if (!row) return base;
  const merged = {
    ...base,
    organization_id: orgId,
    is_enabled: Boolean(row.is_enabled),
    promoter_min_rating: Number(row.promoter_min_rating ?? base.promoter_min_rating),
    question_text: String(row.question_text ?? base.question_text),
    scale_min_label: String(row.scale_min_label ?? base.scale_min_label),
    scale_max_label: String(row.scale_max_label ?? base.scale_max_label),
    follow_up_mode: String(row.follow_up_mode ?? base.follow_up_mode) as CustomerSurveySettingsFormValues["follow_up_mode"],
    follow_up_single: row.follow_up_single != null ? String(row.follow_up_single) : "",
    follow_up_low: row.follow_up_low != null ? String(row.follow_up_low) : "",
    follow_up_mid: row.follow_up_mid != null ? String(row.follow_up_mid) : "",
    follow_up_high: row.follow_up_high != null ? String(row.follow_up_high) : "",
    closing_message: String(row.closing_message ?? base.closing_message),
    survey_page_title: String(row.survey_page_title ?? base.survey_page_title),
    thank_you_message: String(row.thank_you_message ?? base.thank_you_message),
  };
  return customerSurveySettingsSchema.parse(merged);
}

export function useCustomerSurveySettings(organizationId: string | null | undefined) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: customerSurveySettingsQueryKey(organizationId),
    enabled: Boolean(organizationId),
    queryFn: async (): Promise<CustomerSurveySettingsFormValues> => {
      const oid = organizationId as string;
      const { data, error } = await supabase
        .from("organization_customer_survey_settings")
        .select("*")
        .eq("organization_id", oid)
        .maybeSingle();
      if (error) throw error;
      return rowToForm(oid, (data ?? null) as Record<string, unknown> | null);
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (values: CustomerSurveySettingsFormValues) => {
      const parsed = customerSurveySettingsSchema.parse(values);
      const payload = {
        organization_id: parsed.organization_id,
        is_enabled: parsed.is_enabled,
        promoter_min_rating: parsed.promoter_min_rating,
        question_text: parsed.question_text,
        scale_min_label: parsed.scale_min_label,
        scale_max_label: parsed.scale_max_label,
        follow_up_mode: parsed.follow_up_mode,
        follow_up_single: parsed.follow_up_single?.trim() ? parsed.follow_up_single : null,
        follow_up_low: parsed.follow_up_low?.trim() ? parsed.follow_up_low : null,
        follow_up_mid: parsed.follow_up_mid?.trim() ? parsed.follow_up_mid : null,
        follow_up_high: parsed.follow_up_high?.trim() ? parsed.follow_up_high : null,
        closing_message: parsed.closing_message,
        survey_page_title: parsed.survey_page_title,
        thank_you_message: parsed.thank_you_message,
      };

      const { error } = await supabase.from("organization_customer_survey_settings").upsert(payload, {
        onConflict: "organization_id",
      });
      if (error) throw error;
    },
    onSuccess: async (_, vars) => {
      await qc.invalidateQueries({ queryKey: customerSurveySettingsQueryKey(vars.organization_id) });
    },
  });

  const defaults = useMemo(
    () => (organizationId ? defaultCustomerSurveySettings(organizationId) : null),
    [organizationId],
  );

  return {
    ...query,
    defaults,
    saveMutation,
  };
}
