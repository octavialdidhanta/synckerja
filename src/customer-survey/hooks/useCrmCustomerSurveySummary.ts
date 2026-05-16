import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ConversationSummaryPeriodKey } from "@/5-3-dashboard/components/crm/crmConversationSummaryMetrics";
import { DEFAULT_ORG_PROMOTER_PCT_TARGET, MIN_SURVEY_RESPONSES_FOR_STATUS } from "@/features/customer-survey/core/surveyPromoterTarget";
import { supabase } from "@/shared/lib/supabaseClient";

export type CrmCustomerSurveyAssigneeRow = {
  assignee_id: string | null;
  assignee_name: string;
  response_count: number;
  promoter_count: number;
  promoter_pct: number;
  target_promoter_pct: number;
  has_assignee_override: boolean;
  counts_by_rating: Record<string, number>;
};

export type CrmCustomerSurveySummary = {
  total_responses: number;
  promoter_count: number;
  promoter_pct: number;
  promoter_min_rating: number;
  org_promoter_pct_target: number;
  min_responses_for_status: number;
  counts_by_rating: Record<string, number>;
  by_assignee: CrmCustomerSurveyAssigneeRow[];
};

/** Calendar inclusive window [from, to) in local time — matches CRM date semantics for dashboards. */
export function surveySummaryExclusiveRange(period: ConversationSummaryPeriodKey): { from: Date; to: Date } {
  const startOfLocalDay = (d: Date) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  };
  const addDays = (d: Date, n: number) => {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
  };

  const todayStart = startOfLocalDay(new Date());
  const to = addDays(todayStart, 1);
  if (period === "all") {
    return { from: new Date(0), to };
  }
  const days = Number(period);
  const from = addDays(todayStart, -(days - 1));
  return { from, to };
}

export function useCrmCustomerSurveySummary(
  organizationId: string | null | undefined,
  period: ConversationSummaryPeriodKey,
) {
  const { from, to } = useMemo(() => surveySummaryExclusiveRange(period), [period]);

  return useQuery({
    queryKey: [
      "crm-customer-survey-summary",
      organizationId,
      from.toISOString(),
      to.toISOString(),
    ],
    enabled: Boolean(organizationId),
    queryFn: async (): Promise<CrmCustomerSurveySummary> => {
      const { data, error } = await supabase.rpc("crm_customer_survey_summary", {
        p_organization_id: organizationId as string,
        p_from: from.toISOString(),
        p_to: to.toISOString(),
      });
      if (error) {
        const code = (error as { code?: string }).code;
        if (code === "PGRST202") {
          throw new Error(
            "crm_customer_survey_summary RPC is not deployed. Apply Supabase migrations (20260518100000_customer_survey_wa.sql and 20260520120000_customer_survey_promoter_targets.sql), then reload the API schema.",
          );
        }
        throw error;
      }
      if (!data || typeof data !== "object") {
        return {
          total_responses: 0,
          promoter_count: 0,
          promoter_pct: 0,
          promoter_min_rating: 4,
          org_promoter_pct_target: DEFAULT_ORG_PROMOTER_PCT_TARGET,
          min_responses_for_status: MIN_SURVEY_RESPONSES_FOR_STATUS,
          counts_by_rating: {},
          by_assignee: [],
        };
      }
      const o = data as Record<string, unknown>;
      const counts = (o.counts_by_rating ?? {}) as Record<string, unknown>;
      const normalizedCounts: Record<string, number> = {};
      for (let i = 1; i <= 5; i++) {
        const k = String(i);
        const v = counts[k];
        normalizedCounts[k] = typeof v === "number" ? v : Number(v ?? 0);
      }
      const rows = Array.isArray(o.by_assignee) ? o.by_assignee : [];
      const orgTarget = Number(o.org_promoter_pct_target ?? DEFAULT_ORG_PROMOTER_PCT_TARGET);
      return {
        total_responses: Number(o.total_responses ?? 0),
        promoter_count: Number(o.promoter_count ?? 0),
        promoter_pct: Number(o.promoter_pct ?? 0),
        promoter_min_rating: Number(o.promoter_min_rating ?? 4),
        org_promoter_pct_target: orgTarget,
        min_responses_for_status: Number(o.min_responses_for_status ?? MIN_SURVEY_RESPONSES_FOR_STATUS),
        counts_by_rating: normalizedCounts,
        by_assignee: rows.map((raw) => {
          const r = raw as Record<string, unknown>;
          const cr = (r.counts_by_rating ?? {}) as Record<string, unknown>;
          const cbr: Record<string, number> = {};
          for (let i = 1; i <= 5; i++) {
            const k = String(i);
            const v = cr[k];
            cbr[k] = typeof v === "number" ? v : Number(v ?? 0);
          }
          return {
            assignee_id: (r.assignee_id as string | null) ?? null,
            assignee_name: String(r.assignee_name ?? "—"),
            response_count: Number(r.response_count ?? 0),
            promoter_count: Number(r.promoter_count ?? 0),
            promoter_pct: Number(r.promoter_pct ?? 0),
            target_promoter_pct: Number(r.target_promoter_pct ?? orgTarget),
            has_assignee_override: Boolean(r.has_assignee_override),
            counts_by_rating: cbr,
          };
        }),
      };
    },
    staleTime: 30_000,
  });
}
