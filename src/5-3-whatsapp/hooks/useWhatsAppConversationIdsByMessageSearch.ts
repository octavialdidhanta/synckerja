import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';

const QUERY_KEY = ['whatsapp-conversation-ids-by-message-search'] as const;

/**
 * Returns conversation IDs that have at least one message whose body matches the search (search di seluruh isi chat).
 */
export function useWhatsAppConversationIdsByMessageSearch(searchQuery: string) {
  const { organizationId } = useCurrentOrg();
  const trimmed = searchQuery.trim();

  return useQuery({
    queryKey: [...QUERY_KEY, organizationId, trimmed],
    enabled: !!organizationId && trimmed.length > 0,
    queryFn: async (): Promise<string[]> => {
      if (!organizationId || !trimmed) return [];
      const { data, error } = await supabase.rpc('get_whatsapp_conversation_ids_by_message_search', {
        p_organization_id: organizationId,
        p_search: trimmed,
      });
      if (error) throw error;
      const arr = data ?? [];
      return arr.map((id: unknown) => (typeof id === 'string' ? id : String(id)));
    },
  });
}
