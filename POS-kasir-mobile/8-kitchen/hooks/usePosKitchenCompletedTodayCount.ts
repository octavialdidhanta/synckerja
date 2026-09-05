import { useQuery } from "@tanstack/react-query";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { supabase } from "@/shared/lib/supabaseClient";
import {
  mapPosKitchenTicketRow,
  POS_KITCHEN_TICKET_SELECT,
} from "../lib/mapPosKitchenTicketRow";
import {
  POS_KITCHEN_COMPLETED_TODAY_QUERY_KEY,
  type PosKitchenTicket,
} from "../lib/posKitchenTypes";

/** Local calendar day start (00:00:00.000). */
export function startOfLocalDayIso(now = new Date()): string {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/** Done tickets completed today (local day) — archive list; page excludes Recall stack. */
export function usePosKitchenCompletedTodayTickets(outletId: string | null) {
  const { organizationId } = useCurrentOrg();

  return useQuery({
    queryKey: [POS_KITCHEN_COMPLETED_TODAY_QUERY_KEY, organizationId, outletId],
    enabled: Boolean(organizationId && outletId),
    staleTime: 0,
    refetchOnMount: "always",
    queryFn: async (): Promise<PosKitchenTicket[]> => {
      if (!organizationId || !outletId) return [];

      const since = startOfLocalDayIso();

      const { data, error } = await supabase
        .from("pos_kitchen_tickets")
        .select(POS_KITCHEN_TICKET_SELECT)
        .eq("organization_id", organizationId)
        .eq("outlet_id", outletId)
        .eq("status", "done")
        .gte("completed_at", since)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return ((data ?? []) as unknown[]).map(mapPosKitchenTicketRow);
    },
  });
}
