import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";

export const WHATSAPP_UNREAD_COUNTS_QUERY_ROOT = "whatsapp-unread-counts-raw" as const;

export type WhatsAppUnreadRow = {
  conversation_id: string;
  unread_count: number;
};

export function whatsAppUnreadCountsQueryKey(organizationId: string | null | undefined) {
  return [WHATSAPP_UNREAD_COUNTS_QUERY_ROOT, organizationId] as const;
}

export async function fetchWhatsAppUnreadCounts(
  organizationId: string,
): Promise<WhatsAppUnreadRow[]> {
  const { data, error } = await supabase.rpc("get_whatsapp_unread_counts", {
    p_organization_id: organizationId,
  });
  if (error) throw error;
  return (data ?? []) as WhatsAppUnreadRow[];
}

export function whatsAppUnreadTotal(rows: WhatsAppUnreadRow[]): number {
  return rows.reduce((sum, row) => sum + (Number(row.unread_count) || 0), 0);
}

export function whatsAppUnreadByConversation(
  rows: WhatsAppUnreadRow[],
): Record<string, number> {
  const map: Record<string, number> = {};
  for (const row of rows) {
    const id = row.conversation_id;
    const count = Number(row.unread_count) || 0;
    if (id && count > 0) map[id] = count;
  }
  return map;
}

/** Single shared query + one realtime channel for WhatsApp unread RPC. */
export function useWhatsAppUnreadCountsRows(refetchIntervalMs?: number) {
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
      .channel(`whatsapp_unread_counts_${organizationId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "whatsapp_messages" },
        () => {
          queryClient.invalidateQueries({
            queryKey: whatsAppUnreadCountsQueryKey(organizationId),
          });
        },
      )
      .subscribe();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [organizationId, queryClient]);

  return useQuery({
    queryKey: whatsAppUnreadCountsQueryKey(organizationId),
    enabled: !!organizationId,
    queryFn: async (): Promise<WhatsAppUnreadRow[]> => {
      if (!organizationId) return [];
      return fetchWhatsAppUnreadCounts(organizationId);
    },
    staleTime: 15_000,
    refetchInterval: refetchIntervalMs,
  });
}

export function invalidateWhatsAppUnreadCounts(
  queryClient: ReturnType<typeof useQueryClient>,
  organizationId?: string | null,
) {
  queryClient.invalidateQueries({
    queryKey: [WHATSAPP_UNREAD_COUNTS_QUERY_ROOT, organizationId ?? undefined],
  });
  queryClient.invalidateQueries({
    queryKey: [WHATSAPP_UNREAD_COUNTS_QUERY_ROOT],
  });
}
