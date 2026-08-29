import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import {
  invalidateWhatsAppUnreadCounts,
  useWhatsAppUnreadCountsRows,
  whatsAppUnreadByConversation,
} from "./whatsappUnreadCountsShared";

const LIST_REFETCH_MS = 15_000;

export function useWhatsAppUnreadByConversation() {
  const queryClient = useQueryClient();
  const query = useWhatsAppUnreadCountsRows(LIST_REFETCH_MS);
  const rows = query.data ?? [];

  const markConversationRead = async (conversationId: string) => {
    const { error } = await supabase.rpc("mark_whatsapp_conversation_read", {
      p_conversation_id: conversationId,
    });
    if (error) throw error;
    invalidateWhatsAppUnreadCounts(queryClient);
    queryClient.invalidateQueries({ queryKey: ["whatsapp-conversations"] });
  };

  return {
    unreadByConversation: whatsAppUnreadByConversation(rows),
    isLoading: query.isLoading,
    error: query.error,
    markConversationRead,
  };
}
