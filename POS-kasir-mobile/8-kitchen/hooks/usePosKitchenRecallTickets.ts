import { useQuery } from "@tanstack/react-query";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { supabase } from "@/shared/lib/supabaseClient";
import {
  mapPosKitchenTicketRow,
  POS_KITCHEN_TICKET_SELECT,
} from "../lib/mapPosKitchenTicketRow";
import {
  POS_KITCHEN_RECALL_MAX,
  POS_KITCHEN_RECALL_WINDOW_MS,
  selectKitchenRecallTickets,
} from "../lib/partitionKitchenDoneBoards";
import {
  POS_KITCHEN_RECALL_QUERY_KEY,
  type PosKitchenTicket,
} from "../lib/posKitchenTypes";

export {
  POS_KITCHEN_RECALL_MAX,
  POS_KITCHEN_RECALL_WINDOW_MS,
} from "../lib/partitionKitchenDoneBoards";

/**
 * Short recall stack: done tickets within the last 15 minutes, max 10,
 * most recently completed first (safety net after bump — not a full archive).
 */
export function usePosKitchenRecallTickets(outletId: string | null) {
  const { organizationId } = useCurrentOrg();

  return useQuery({
    queryKey: [POS_KITCHEN_RECALL_QUERY_KEY, organizationId, outletId],
    enabled: Boolean(organizationId && outletId),
    staleTime: 0,
    refetchOnMount: "always",
    queryFn: async (): Promise<PosKitchenTicket[]> => {
      if (!organizationId || !outletId) return [];

      const since = new Date(Date.now() - POS_KITCHEN_RECALL_WINDOW_MS).toISOString();

      const { data, error } = await supabase
        .from("pos_kitchen_tickets")
        .select(POS_KITCHEN_TICKET_SELECT)
        .eq("organization_id", organizationId)
        .eq("outlet_id", outletId)
        .eq("status", "done")
        .gte("completed_at", since)
        .order("completed_at", { ascending: false })
        .limit(POS_KITCHEN_RECALL_MAX);

      if (error) throw error;
      // Client-side partition keeps window/max rules consistent with unit tests.
      return selectKitchenRecallTickets(
        ((data ?? []) as unknown[]).map(mapPosKitchenTicketRow),
      );
    },
  });
}
