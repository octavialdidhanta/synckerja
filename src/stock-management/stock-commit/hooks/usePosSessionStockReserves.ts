import { useQuery } from "@tanstack/react-query";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { supabase } from "@/shared/lib/supabaseClient";
import type { PosSessionStockReserve } from "../types/sessionStockReserve";

export const POS_SESSION_STOCK_RESERVES_QUERY_KEY = "pos-session-stock-reserves";

export async function fetchSessionStockReserves(
  sessionId: string,
): Promise<PosSessionStockReserve[]> {
  const { data, error } = await supabase
    .from("pos_session_stock_reserves")
    .select(
      "id, organization_id, outlet_id, session_id, product_id, variant_id, reserved_qty, last_reference_id, last_reserved_at, created_at, updated_at",
    )
    .eq("session_id", sessionId);
  if (error) throw error;
  return (data ?? []) as PosSessionStockReserve[];
}

export function usePosSessionStockReserves(sessionId: string | null | undefined) {
  const { organizationId } = useCurrentOrg();

  return useQuery({
    queryKey: [POS_SESSION_STOCK_RESERVES_QUERY_KEY, organizationId, sessionId],
    queryFn: async () => {
      if (!sessionId) return [];
      return fetchSessionStockReserves(sessionId);
    },
    enabled: Boolean(organizationId && sessionId),
  });
}
