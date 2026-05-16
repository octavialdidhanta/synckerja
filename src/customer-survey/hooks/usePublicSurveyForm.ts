import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";

export type PublicSurveyFormDto = {
  token: string;
  survey_page_title: string;
  question_text: string;
  scale_min_label: string;
  scale_max_label: string;
  follow_up_mode: "none" | "single" | "by_score";
  follow_up_single?: string | null;
  follow_up_low?: string | null;
  follow_up_mid?: string | null;
  follow_up_high?: string | null;
  thank_you_message?: string | null;
};

function parseFormPayload(raw: unknown): { ok: true; data: PublicSurveyFormDto } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") return { ok: false, error: "invalid" };
  const o = raw as Record<string, unknown>;
  if (o.ok !== true) return { ok: false, error: String(o.error ?? "unknown") };
  const token = String(o.token ?? "");
  if (!token) return { ok: false, error: "invalid" };
  return {
    ok: true,
    data: {
      token,
      survey_page_title: String(o.survey_page_title ?? ""),
      question_text: String(o.question_text ?? ""),
      scale_min_label: String(o.scale_min_label ?? ""),
      scale_max_label: String(o.scale_max_label ?? ""),
      follow_up_mode:
        o.follow_up_mode === "single" || o.follow_up_mode === "by_score"
          ? o.follow_up_mode
          : "none",
      follow_up_single: o.follow_up_single != null ? String(o.follow_up_single) : null,
      follow_up_low: o.follow_up_low != null ? String(o.follow_up_low) : null,
      follow_up_mid: o.follow_up_mid != null ? String(o.follow_up_mid) : null,
      follow_up_high: o.follow_up_high != null ? String(o.follow_up_high) : null,
      thank_you_message: o.thank_you_message != null ? String(o.thank_you_message) : null,
    },
  };
}

export function usePublicSurveyForm(token: string | undefined) {
  const trimmed = (token ?? "").trim();

  const formQuery = useQuery({
    queryKey: ["public-customer-survey-form", trimmed],
    enabled: trimmed.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_public_customer_survey_form", {
        p_token: trimmed,
      });
      if (error) throw error;
      const parsed = parseFormPayload(data);
      if (!parsed.ok) {
        throw new Error(parsed.error);
      }
      return parsed.data;
    },
    retry: 0,
  });

  const submitMutation = useMutation({
    mutationFn: async (input: { rating: number; comment: string }) => {
      const { data, error } = await supabase.rpc("submit_customer_survey", {
        p_token: trimmed,
        p_rating: input.rating,
        p_comment: input.comment,
      });
      if (error) throw error;
      if (!data || typeof data !== "object") return { thank_you_message: "" };
      const o = data as Record<string, unknown>;
      if (o.ok !== true) {
        throw new Error(String(o.error ?? "submit_failed"));
      }
      return { thank_you_message: String(o.thank_you_message ?? "") };
    },
  });

  return { token: trimmed, formQuery, submitMutation };
}
