import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';

export type WhatsappCycleMetricRow = {
  conversation_id: string;
  assignee_id: string | null;
  cycle_started_at: string;
  first_response_at: string | null;
  resolved_at: string | null;
  /** From `whatsapp_conversations.channel`: whatsapp | instagram */
  channel?: string | null;
};

type LeadStatusRow = { id: string; name: string; color: string };

/**
 * Queries yang dipakai `LeadsInsights` (metrics siklus WA + status lead).
 * Satu hook agar tidak duplikasi queryFn dan agar halaman report bisa menunggu data ini sebelum skeleton hilang.
 */
export function useLeadsInsightsSupplementalQueries(organizationId: string | null | undefined) {
  const orgId = organizationId ?? null;
  const enabled = !!orgId;

  const cycleQuery = useQuery({
    queryKey: ['whatsapp-cycle-metrics', orgId],
    enabled,
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase.rpc('get_whatsapp_cycle_metrics', {
        p_organization_id: orgId,
      });
      if (error) throw error;
      return (data ?? []) as WhatsappCycleMetricRow[];
    },
    staleTime: 5_000,
    refetchInterval: 5_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  const statusesQuery = useQuery({
    queryKey: ['lead-statuses', orgId],
    enabled,
    queryFn: async () => {
      let q = supabase
        .from('lead_statuses')
        .select('id, name, color')
        .eq('is_active', true)
        .order('sort_order');
      if (orgId) {
        q = q.or(`organization_id.eq.${orgId},organization_id.is.null`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as LeadStatusRow[];
    },
  });

  const insightsSupplementalPending =
    enabled &&
    (cycleQuery.isLoading ||
      statusesQuery.isLoading ||
      (cycleQuery.isFetching && cycleQuery.dataUpdatedAt === 0) ||
      (statusesQuery.isFetching && statusesQuery.dataUpdatedAt === 0));

  const cycleMetricsPending = enabled && cycleQuery.isPending;

  return {
    cycleRows: cycleQuery.data ?? [],
    leadStatusesFromDb: statusesQuery.data ?? [],
    isCycleMetricsError: cycleQuery.isError,
    insightsSupplementalPending,
    cycleMetricsPending,
  };
}
