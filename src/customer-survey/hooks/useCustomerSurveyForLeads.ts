import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { NewLead } from "@/shared/types/leads";
import { supabase } from "@/shared/lib/supabaseClient";
import {
  collectTicketIdsForWaLookup,
  isWhatsappLeadForSurvey,
  resolveWhatsappConversationIdFromLeadId,
} from "@/features/customer-survey/core/resolveWhatsappConversationId";

export type LatestCustomerSurvey = {
  conversationId: string;
  rating: number;
  comment: string | null;
  submittedAt: string;
  assigneeId: string | null;
  assigneeName: string | null;
};

type RpcLatestRow = {
  conversation_id: string;
  rating: number;
  comment: string | null;
  submitted_at: string;
  assignee_id: string | null;
  assignee_name: string | null;
};

export type CustomerSurveyHistoryEntry = {
  id: string;
  rating: number;
  comment: string | null;
  submittedAt: string;
  assigneeId: string | null;
  assigneeName: string | null;
};

function normConvId(id: string | null | undefined): string {
  return String(id ?? "").trim().toLowerCase();
}

function parseLatestRows(raw: unknown): LatestCustomerSurvey[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => {
      const r = row as RpcLatestRow;
      const conversationId = String(r.conversation_id ?? "");
      const rating = Number(r.rating);
      if (!conversationId || !Number.isFinite(rating)) return null;
      return {
        conversationId,
        rating,
        comment: r.comment != null ? String(r.comment) : null,
        submittedAt: String(r.submitted_at ?? ""),
        assigneeId: r.assignee_id != null ? String(r.assignee_id) : null,
        assigneeName: r.assignee_name != null ? String(r.assignee_name) : null,
      } satisfies LatestCustomerSurvey;
    })
    .filter((x): x is LatestCustomerSurvey => x != null);
}

export function useCustomerSurveyLatestByConversations(
  organizationId: string | null | undefined,
  conversationIds: string[],
  options?: { enabled?: boolean },
) {
  const sortedKey = useMemo(
    () => [...new Set(conversationIds.filter(Boolean))].sort().join(","),
    [conversationIds],
  );

  const enabled = options?.enabled ?? true;

  return useQuery({
    queryKey: ["customer-survey-latest-by-conversations", organizationId, sortedKey],
    enabled: enabled && Boolean(organizationId) && conversationIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("customer_survey_latest_by_conversations", {
        p_organization_id: organizationId!,
        p_conversation_ids: conversationIds,
      });
      if (error) throw error;
      return parseLatestRows(data);
    },
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}

export function useTicketToConversationMap(
  organizationId: string | null | undefined,
  ticketIds: string[],
) {
  const sortedKey = useMemo(() => [...new Set(ticketIds)].sort().join(","), [ticketIds]);

  return useQuery({
    queryKey: ["wa-conv-by-ticket-for-survey", organizationId, sortedKey],
    enabled: Boolean(organizationId) && ticketIds.length > 0,
    queryFn: async () => {
      const map = new Map<string, string>();
      const want = new Set(ticketIds.map((t) => t.trim().toUpperCase()).filter(Boolean));
      if (want.size === 0) return map;

      const { data, error } = await supabase
        .from("whatsapp_conversations")
        .select("id, ticket_id")
        .eq("organization_id", organizationId!);
      if (error) throw error;
      for (const row of data ?? []) {
        const convId = String((row as { id: string }).id);
        const tid = String((row as { ticket_id?: string }).ticket_id ?? "").trim().toUpperCase();
        if (tid && want.has(tid)) map.set(tid, convId);
        const generated = `WA-${convId.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
        if (want.has(generated)) map.set(generated, convId);
      }
      return map;
    },
    staleTime: 60_000,
  });
}

export function useCustomerSurveyForLeads(
  organizationId: string | null | undefined,
  leads: NewLead[],
) {
  const ticketIds = useMemo(() => collectTicketIdsForWaLookup(leads), [leads]);
  const ticketMapQuery = useTicketToConversationMap(organizationId, ticketIds);

  const conversationIds = useMemo(() => {
    const ids = new Set<string>();
    for (const lead of leads) {
      const direct = resolveWhatsappConversationIdFromLeadId(lead);
      if (direct) ids.add(direct);
      const tid = (lead.ticket_id ?? "").trim().toUpperCase();
      if (tid && ticketMapQuery.data?.has(tid)) {
        ids.add(ticketMapQuery.data.get(tid)!);
      }
    }
    return [...ids];
  }, [leads, ticketMapQuery.data]);

  /** Ticket→conversation map must settle before batch survey RPC (leads table rows use ticket_id). */
  const ticketMapReady = ticketIds.length === 0 || ticketMapQuery.isFetched;

  const latestQuery = useCustomerSurveyLatestByConversations(organizationId, conversationIds, {
    enabled: ticketMapReady,
  });

  const byConversationId = useMemo(() => {
    const map = new Map<string, LatestCustomerSurvey>();
    for (const row of latestQuery.data ?? []) {
      map.set(normConvId(row.conversationId), row);
    }
    return map;
  }, [latestQuery.data]);

  const resolveConversationId = useCallback(
    (lead: NewLead): string | null => {
      const direct = resolveWhatsappConversationIdFromLeadId(lead);
      if (direct) return normConvId(direct);
      const tid = (lead.ticket_id ?? "").trim().toUpperCase();
      if (tid && ticketMapQuery.data?.has(tid)) return normConvId(ticketMapQuery.data.get(tid)!);
      return null;
    },
    [ticketMapQuery.data],
  );

  const getSurveyForLead = useCallback(
    (lead: NewLead): LatestCustomerSurvey | null => {
      if (!isWhatsappLeadForSurvey(lead)) return null;
      const convId = resolveConversationId(lead);
      if (!convId) return null;
      return byConversationId.get(convId) ?? null;
    },
    [byConversationId, resolveConversationId],
  );

  /** Stable per-lead numeric rating for table sort (same resolution as getSurveyForLead). */
  const surveyRatingByLeadId = useMemo(() => {
    const map = new Map<string, number | null>();
    for (const lead of leads) {
      const leadKey = String(lead.id ?? "");
      if (!isWhatsappLeadForSurvey(lead)) {
        map.set(leadKey, null);
        continue;
      }
      const convId = resolveConversationId(lead);
      if (!convId) {
        map.set(leadKey, null);
        continue;
      }
      const rating = byConversationId.get(convId)?.rating;
      map.set(leadKey, rating != null && Number.isFinite(rating) ? rating : null);
    }
    return map;
  }, [leads, byConversationId, resolveConversationId]);

  const getSurveyFromRpcFields = (lead: NewLead & { latest_survey_rating?: number | null }): LatestCustomerSurvey | null => {
    const rating = lead.latest_survey_rating;
    if (rating == null || !Number.isFinite(Number(rating))) return null;
    const convId = resolveConversationId(lead) ?? "";
    return {
      conversationId: convId,
      rating: Number(rating),
      comment:
        (lead as { latest_survey_comment?: string | null }).latest_survey_comment != null
          ? String((lead as { latest_survey_comment?: string | null }).latest_survey_comment)
          : null,
      submittedAt: "",
      assigneeId: null,
      assigneeName: null,
    };
  };

  return {
    isLoading:
      (ticketIds.length > 0 && ticketMapQuery.isLoading) ||
      (ticketMapReady && latestQuery.isLoading),
    isError: latestQuery.isError || ticketMapQuery.isError,
    getSurveyForLead,
    getSurveyFromRpcFields,
    resolveConversationId,
    /** Changes when latest survey batch loads — use as sort dependency. */
    latestSurveyRows: latestQuery.data,
    surveyRatingByLeadId,
    ticketMapReady,
    refetch: () => {
      void latestQuery.refetch();
      void ticketMapQuery.refetch();
    },
  };
}

export function useCustomerSurveyHistory(conversationId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ["customer-survey-history", conversationId],
    enabled: enabled && Boolean(conversationId),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("customer_survey_history", {
        p_conversation_id: conversationId!,
      });
      if (error) throw error;
      if (!Array.isArray(data)) return [] as CustomerSurveyHistoryEntry[];
      return (data as Array<Record<string, unknown>>).map((row) => ({
        id: String(row.id ?? ""),
        rating: Number(row.rating),
        comment: row.comment != null ? String(row.comment) : null,
        submittedAt: String(row.submitted_at ?? ""),
        assigneeId: row.assignee_id != null ? String(row.assignee_id) : null,
        assigneeName: row.assignee_name != null ? String(row.assignee_name) : null,
      }));
    },
  });
}
