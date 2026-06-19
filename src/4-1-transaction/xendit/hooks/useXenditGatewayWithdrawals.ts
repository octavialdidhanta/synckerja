import { useQuery } from "@tanstack/react-query";
import { fetchGatewayWithdrawals } from "@/xendit/lib/xenditApi";
import type { XenditGatewayWithdrawalRow } from "@/xendit/lib/xenditApi";

export function useXenditGatewayWithdrawals(
  organizationId: string | null | undefined,
  enabled = true,
  options?: { subAccountId?: string | null; limit?: number },
) {
  const subAccountId = options?.subAccountId;
  const limit = options?.limit ?? 20;
  const filterKey = subAccountId ?? "all";
  return useQuery({
    queryKey: ["xendit-gateway-withdrawals", organizationId, filterKey, limit],
    queryFn: async () => {
      if (!organizationId) return [] as XenditGatewayWithdrawalRow[];
      const res = await fetchGatewayWithdrawals(organizationId, {
        limit,
        subAccountId: subAccountId ?? undefined,
      });
      return res.withdrawals ?? [];
    },
    enabled: Boolean(organizationId && enabled),
    staleTime: 15_000,
  });
}
