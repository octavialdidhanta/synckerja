import { useMutation, useQueryClient } from "@tanstack/react-query";
import { posRefundStoreCheckout } from "@/5-2-customer-visits/checkout/lib/posRefundStoreCheckout";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { reversePaidCheckoutStock } from "@/stock-management/stock-commit/lib/pay/reversePaidCheckoutStock";
import { POS_SESSION_STOCK_COMMITS_QUERY_KEY } from "@/stock-management/stock-commit/hooks/usePosSessionStockCommits";
import { POS_SESSION_STOCK_RESERVES_QUERY_KEY } from "@/stock-management/stock-commit/hooks/usePosSessionStockReserves";
import { POS_ACTIVITY_QUERY_KEY } from "@/pos-mobile/7-activity/lib/posActivityTypes";

export type PosCheckoutRefundInput = {
  activityId: string;
  sessionId?: string | null;
  outletId?: string | null;
  reverseId?: string;
  reason?: string | null;
  shiftId?: string | null;
};

export function usePosCheckoutRefund() {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: PosCheckoutRefundInput) => {
      if (!organizationId) throw new Error("Organization ID is required");
      if (!input.activityId?.trim()) {
        throw new Error("pos_refund_activity_required");
      }
      const reverseId = input.reverseId ?? `refund-${input.activityId}`;

      const stock = await reversePaidCheckoutStock({
        organizationId,
        activityId: input.activityId,
        sessionId: input.sessionId,
        outletId: input.outletId,
        reverseId,
        rollbackActivity: false,
      });

      const ledger = await posRefundStoreCheckout({
        activityId: input.activityId,
        reason: input.reason,
        shiftId: input.shiftId,
        reverseId,
      });

      return { ...stock, ledger };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["customer-visit-catalog"] });
      void queryClient.invalidateQueries({ queryKey: [POS_SESSION_STOCK_COMMITS_QUERY_KEY] });
      void queryClient.invalidateQueries({ queryKey: [POS_SESSION_STOCK_RESERVES_QUERY_KEY] });
      void queryClient.invalidateQueries({ queryKey: [POS_ACTIVITY_QUERY_KEY] });
      void queryClient.invalidateQueries({ queryKey: ["pos-sales-summary-report"] });
      void queryClient.invalidateQueries({ queryKey: ["pos-shift-sales"] });
      void queryClient.invalidateQueries({ queryKey: ["pos-cashier-shifts"] });
      void queryClient.invalidateQueries({ queryKey: ["pos-sales-summary-daily"] });
      void queryClient.invalidateQueries({ queryKey: ["pos-gross-profit-report"] });
      void queryClient.invalidateQueries({ queryKey: ["pos-gross-profit-by-item"] });
    },
  });
}
