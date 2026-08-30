import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { supabase } from "@/shared/lib/supabaseClient";
import {
  mapPosKitchenTicketRow,
  POS_KITCHEN_TICKET_SELECT,
} from "../lib/mapPosKitchenTicketRow";
import {
  POS_KITCHEN_ACTIVE_STATUSES,
  POS_KITCHEN_COMPLETED_TODAY_QUERY_KEY,
  POS_KITCHEN_RECALL_QUERY_KEY,
  POS_KITCHEN_TICKETS_QUERY_KEY,
  type PosKitchenTicket,
  type PosKitchenTicketStatus,
} from "../lib/posKitchenTypes";

function isActiveStatus(s: string): s is PosKitchenTicketStatus {
  return (POS_KITCHEN_ACTIVE_STATUSES as readonly string[]).includes(s);
}

/** Invalidate active + recall + completed-today board queries for an outlet. */
export function invalidatePosKitchenBoardQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  organizationId: string | null | undefined,
  outletId: string | null,
) {
  void queryClient.invalidateQueries({
    queryKey: [POS_KITCHEN_TICKETS_QUERY_KEY, organizationId, outletId],
  });
  void queryClient.invalidateQueries({
    queryKey: [POS_KITCHEN_RECALL_QUERY_KEY, organizationId, outletId],
  });
  void queryClient.invalidateQueries({
    queryKey: [POS_KITCHEN_COMPLETED_TODAY_QUERY_KEY, organizationId, outletId],
  });
}

export function usePosKitchenTickets(outletId: string | null) {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [POS_KITCHEN_TICKETS_QUERY_KEY, organizationId, outletId],
    enabled: Boolean(organizationId && outletId),
    queryFn: async (): Promise<PosKitchenTicket[]> => {
      if (!organizationId || !outletId) return [];

      const { data, error } = await supabase
        .from("pos_kitchen_tickets")
        .select(POS_KITCHEN_TICKET_SELECT)
        .eq("organization_id", organizationId)
        .eq("outlet_id", outletId)
        .in("status", [...POS_KITCHEN_ACTIVE_STATUSES])
        .order("created_at", { ascending: true });

      if (error) throw error;

      return ((data ?? []) as unknown[])
        .map(mapPosKitchenTicketRow)
        .filter((row) => isActiveStatus(row.status));
    },
  });

  useEffect(() => {
    if (!outletId) return;

    const channel = supabase
      .channel(`pos-kitchen-tickets-${outletId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "pos_kitchen_tickets",
          filter: `outlet_id=eq.${outletId}`,
        },
        () => {
          invalidatePosKitchenBoardQueries(queryClient, organizationId, outletId);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [outletId, organizationId, queryClient]);

  return query;
}
