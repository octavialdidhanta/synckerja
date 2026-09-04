import { useQuery } from "@tanstack/react-query";
import { loadRefundStockPolicy } from "../lib/refund";

export const POS_REFUND_STOCK_POLICY_QUERY_KEY = "pos-refund-stock-policy";

export function usePosRefundStockPolicy(
  sessionId: string | null | undefined,
  enabled: boolean,
) {
  return useQuery({
    queryKey: [POS_REFUND_STOCK_POLICY_QUERY_KEY, sessionId ?? "none"],
    enabled,
    queryFn: () => loadRefundStockPolicy(sessionId),
  });
}
