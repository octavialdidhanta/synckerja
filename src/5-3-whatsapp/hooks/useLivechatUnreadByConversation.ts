import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import type { LiveChatConversation } from "../types";
import {
  fetchWhatsAppUnreadCounts,
  invalidateWhatsAppUnreadCounts,
  whatsAppUnreadCountsQueryKey,
  whatsAppUnreadByConversation,
} from "./whatsappUnreadCountsShared";

const QUERY_KEY = ["livechat-unread-by-conversation"] as const;

function rowsToMap(data: unknown): Record<string, number> {
  const map: Record<string, number> = {};
  for (const row of (data ?? []) as Array<{ conversation_id: string; unread_count: number }>) {
    const id = row.conversation_id;
    const count = Number(row.unread_count) || 0;
    if (id && count > 0) map[id] = count;
  }
  return map;
}

export function useLivechatUnreadByConversation() {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!organizationId) return;
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    channelRef.current = supabase
      .channel(`livechat_messages_unread_${organizationId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "whatsapp_messages" }, () => {
        queryClient.invalidateQueries({ queryKey: QUERY_KEY });
        invalidateWhatsAppUnreadCounts(queryClient, organizationId);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "instagram_messages" }, () => {
        queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "facebook_messages" }, () => {
        queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      })
      .subscribe();
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [organizationId, queryClient]);

  const query = useQuery({
    queryKey: [...QUERY_KEY, organizationId],
    enabled: !!organizationId,
    queryFn: async (): Promise<Record<string, number>> => {
      if (!organizationId) return {};

      const waRows = await queryClient.fetchQuery({
        queryKey: whatsAppUnreadCountsQueryKey(organizationId),
        queryFn: () => fetchWhatsAppUnreadCounts(organizationId),
        staleTime: 15_000,
      });

      const [igRes, fbRes] = await Promise.all([
        supabase.rpc("get_instagram_unread_counts", { p_organization_id: organizationId }),
        supabase.rpc("get_facebook_unread_counts", { p_organization_id: organizationId }),
      ]);
      if (igRes.error) throw igRes.error;
      if (fbRes.error) throw fbRes.error;

      return {
        ...whatsAppUnreadByConversation(waRows),
        ...rowsToMap(igRes.data),
        ...rowsToMap(fbRes.data),
      };
    },
    staleTime: 15_000,
    refetchInterval: 15_000,
  });

  const markConversationRead = async (conv: LiveChatConversation) => {
    if (conv.source === "whatsapp") {
      const { error } = await supabase.rpc("mark_whatsapp_conversation_read", {
        p_conversation_id: conv.id,
      });
      if (error) throw error;
    } else if (conv.source === "instagram") {
      const { error } = await supabase.rpc("mark_instagram_conversation_read", {
        p_conversation_id: conv.id,
      });
      if (error) throw error;
    } else if (conv.source === "facebook") {
      const { error } = await supabase.rpc("mark_facebook_conversation_read", {
        p_conversation_id: conv.id,
      });
      if (error) throw error;
    } else {
      return;
    }
    queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    queryClient.invalidateQueries({ queryKey: ["whatsapp-conversations"] });
    queryClient.invalidateQueries({ queryKey: ["instagram-conversations"] });
    queryClient.invalidateQueries({ queryKey: ["facebook-conversations"] });
    invalidateWhatsAppUnreadCounts(queryClient, organizationId);
  };

  return {
    unreadByConversation: query.data ?? {},
    isLoading: query.isLoading,
    error: query.error,
    markConversationRead,
  };
}
