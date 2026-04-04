import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';

export interface ConversationCycle {
  id: string;
  conversation_id: string;
  cycle_started_at: string;
  first_response_at: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Fetches the current open cycle (resolved_at is null) for a conversation.
 * Used to show response time (first_response_at - cycle_started_at) and "not yet resolved".
 */
export function useCurrentConversationCycle(conversationId: string | null) {
  return useQuery({
    queryKey: ['whatsapp-conversation-cycle', conversationId],
    enabled: !!conversationId,
    queryFn: async (): Promise<ConversationCycle | null> => {
      if (!conversationId) return null;
      const { data, error } = await supabase
        .from('whatsapp_conversation_cycles')
        .select('id, conversation_id, cycle_started_at, first_response_at, resolved_at, created_at, updated_at')
        .eq('conversation_id', conversationId)
        .is('resolved_at', null)
        .order('cycle_started_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as ConversationCycle | null;
    },
  });
}

/**
 * Fetches the latest closed cycle (resolved_at is not null) for a conversation.
 * Used to show time-to-resolve (resolved_at - cycle_started_at) for last cycle.
 */
export function useLatestResolvedCycle(conversationId: string | null) {
  return useQuery({
    queryKey: ['whatsapp-conversation-cycle-resolved', conversationId],
    enabled: !!conversationId,
    queryFn: async (): Promise<ConversationCycle | null> => {
      if (!conversationId) return null;
      const { data, error } = await supabase
        .from('whatsapp_conversation_cycles')
        .select('id, conversation_id, cycle_started_at, first_response_at, resolved_at, created_at, updated_at')
        .eq('conversation_id', conversationId)
        .not('resolved_at', 'is', null)
        .order('resolved_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as ConversationCycle | null;
    },
  });
}

export function formatDurationMs(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3600_000) return `${Math.round(ms / 60_000)}m`;
  const h = Math.floor(ms / 3600_000);
  const m = Math.round((ms % 3600_000) / 60_000);
  return m ? `${h}h ${m}m` : `${h}h`;
}
