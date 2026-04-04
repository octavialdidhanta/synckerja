import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';

export interface WhatsAppMessageSearchResult {
  conversation_id: string;
  message_id: string;
  body: string | null;
  created_at: string;
  direction: string;
}

const QUERY_KEY = ['whatsapp-message-search'] as const;

export function useWhatsAppMessageSearch(searchQuery: string) {
  const { organizationId } = useCurrentOrg();
  const trimmed = searchQuery.trim();

  return useQuery({
    queryKey: [...QUERY_KEY, organizationId, trimmed],
    enabled: !!organizationId && trimmed.length > 0,
    queryFn: async (): Promise<WhatsAppMessageSearchResult[]> => {
      if (!organizationId || !trimmed) return [];
      const { data, error } = await supabase.rpc('search_whatsapp_messages', {
        p_organization_id: organizationId,
        p_search: trimmed,
      });
      if (error) throw error;
      return (data ?? []).map((row: { conversation_id: string; message_id: string; body: string | null; created_at: string; direction: string }) => ({
        conversation_id: row.conversation_id,
        message_id: row.message_id,
        body: row.body ?? null,
        created_at: row.created_at,
        direction: row.direction ?? 'inbound',
      }));
    },
  });
}
