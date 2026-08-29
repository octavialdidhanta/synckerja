import { useQuery } from "@tanstack/react-query";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { supabase } from "@/shared/lib/supabaseClient";
import type { PosSessionStockCommit } from "../types/sessionStockCommit";

export const POS_SESSION_STOCK_COMMITS_QUERY_KEY = "pos-session-stock-commits";

export async function fetchSessionStockCommits(
  sessionId: string,
): Promise<PosSessionStockCommit[]> {
  const { data, error } = await supabase
    .from("pos_session_stock_commits")
    .select(
      "id, organization_id, outlet_id, session_id, line_fingerprint, line_index, committed_qty, last_reference_id, last_committed_at, created_at, updated_at",
    )
    .eq("session_id", sessionId);
  if (error) throw error;
  return (data ?? []) as PosSessionStockCommit[];
}

export function usePosSessionStockCommits(sessionId: string | null | undefined) {
  const { organizationId } = useCurrentOrg();

  return useQuery({
    queryKey: [POS_SESSION_STOCK_COMMITS_QUERY_KEY, organizationId, sessionId],
    queryFn: async () => {
      if (!sessionId) return [];
      return fetchSessionStockCommits(sessionId);
    },
    enabled: Boolean(organizationId && sessionId),
  });
}
