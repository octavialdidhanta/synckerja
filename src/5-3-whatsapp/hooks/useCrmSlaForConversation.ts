import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';

export type LivechatCrmSlaSnapshot = {
  conversation_id: string;
  assignment_due_at: string | null;
  resolution_due_at: string | null;
  first_response_at: string | null;
  resolved_at: string | null;
  sla_first_reply_status: string | null;
  sla_first_reply_late_minutes: number | null;
  sla_resolution_status: string | null;
  sla_resolution_late_minutes: number | null;
  sla_inter_reply_status: string | null;
  sla_inter_reply_late_minutes: number | null;
  first_response_sla_minutes: number | null;
  resolution_sla_minutes: number | null;
};

export function livechatSlaRpcChannel(source: string | undefined | null): string {
  const s = String(source ?? 'whatsapp').trim().toLowerCase();
  if (s === 'instagram') return 'instagram';
  if (s === 'facebook' || s === 'messenger') return 'facebook';
  if (s === 'email') return 'email';
  return 'whatsapp';
}

export function useCrmSlaForConversation(
  organizationId: string | null | undefined,
  conversationId: string | null | undefined,
  source: string | null | undefined,
) {
  const orgId = organizationId ?? null;
  const convId = conversationId ?? null;
  const channel = livechatSlaRpcChannel(source);

  return useQuery({
    queryKey: ['crm-sla-conversation', orgId, convId, channel] as const,
    enabled: Boolean(orgId && convId),
    queryFn: async (): Promise<LivechatCrmSlaSnapshot | null> => {
      if (!orgId || !convId) return null;
      // Backfill open cycle when missing (ignored if RPC not deployed yet).
      const { error: ensureError } = await supabase.rpc('ensure_open_omnichannel_conversation_cycle', {
        p_organization_id: orgId,
        p_conversation_id: convId,
        p_channel: channel,
      });
      if (ensureError && import.meta.env.DEV) {
        console.warn('[crm-sla] ensure_open_omnichannel_conversation_cycle:', ensureError.message);
      }
      const { data, error } = await supabase.rpc('get_crm_sla_for_conversation', {
        p_organization_id: orgId,
        p_conversation_id: convId,
        p_channel: channel,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : null;
      if (!row || typeof row !== 'object') return null;
      return row as LivechatCrmSlaSnapshot;
    },
    staleTime: 5_000,
    refetchInterval: 5_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    placeholderData: keepPreviousData,
  });
}
