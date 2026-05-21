import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';

export type CrmAssigneeSegment = 'admin' | 'supervisor' | 'agent' | 'unassigned';

export type CrmRoomCycleRow = {
  conversation_id: string;
  customer_display: string;
  assignee_name: string;
  assignee_id: string | null;
  crm_assignee_segment: CrmAssigneeSegment;
  channel: string;
  sla_first_reply_status: string | null;
  sla_first_reply_late_minutes: number | null;
  sla_resolution_status: string | null;
  sla_resolution_late_minutes: number | null;
  /** Inbound-after-first-reply → next outbound within policy inter_reply minutes (working time). */
  sla_inter_reply_status: string | null;
  sla_inter_reply_late_minutes: number | null;
  cycle_started_at: string;
  assignment_due_at: string | null;
  resolution_due_at: string | null;
  first_response_at: string | null;
  /** Latest cycle: null while conversation still in open cycle */
  resolved_at: string | null;
};

/** @deprecated Use CrmRoomCycleRow — kept for existing imports */
export type CrmFirstResponseRoomRow = CrmRoomCycleRow;

/**
 * Denormalized rows for CRM room tables (first response + resolution) — single RPC join.
 * Invalidated with WhatsApp / cycle metrics (see `useLeads` realtime in sales.ts).
 */
export function useCrmFirstResponsePerRoom(organizationId: string | null | undefined) {
  const orgId = organizationId ?? null;
  const enabled = !!orgId;

  return useQuery({
    queryKey: ['crm-first-response-per-room', orgId],
    enabled,
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase.rpc('get_crm_first_response_time_per_room', {
        p_organization_id: orgId,
      });
      if (error) throw error;
      return (data ?? []) as CrmRoomCycleRow[];
    },
    staleTime: 5_000,
    refetchInterval: 5_000,
    /** CRM: refresh on tab focus without clearing tables (halaman-tidak-reload-otomatis). */
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    placeholderData: keepPreviousData,
  });
}
