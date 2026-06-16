import { useQuery } from "@tanstack/react-query";
import { fetchGatewayWithdrawals } from "@/xendit/lib/xenditApi";
import type { XenditGatewayWithdrawalRow } from "@/xendit/lib/xenditApi";

export function useXenditGatewayWithdrawals(
  organizationId: string | null | undefined,
  enabled = true,
) {
  return useQuery({
    queryKey: ["xendit-gateway-withdrawals", organizationId],
    queryFn: async () => {
      if (!organizationId) return [] as XenditGatewayWithdrawalRow[];
      const res = await fetchGatewayWithdrawals(organizationId, 20);
      return res.withdrawals ?? [];
    },
    enabled: Boolean(organizationId && enabled),
    staleTime: 15_000,
  });
}
