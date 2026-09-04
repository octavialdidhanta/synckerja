import { useMutation, useQueryClient } from "@tanstack/react-query";
import { posRefundStoreCheckout } from "@/5-2-customer-visits/checkout/lib/posRefundStoreCheckout";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { reversePaidCheckoutStock } from "@/stock-management/stock-commit/lib/pay/reversePaidCheckoutStock";
import { POS_SESSION_STOCK_COMMITS_QUERY_KEY } from "@/stock-management/stock-commit/hooks/usePosSessionStockCommits";
import { POS_SESSION_STOCK_RESERVES_QUERY_KEY } from "@/stock-management/stock-commit/hooks/usePosSessionStockReserves";
import { POS_ACTIVITY_QUERY_KEY } from "@/pos-mobile/7-activity/lib/posActivityTypes";
import { voidKitchenTicketsForRefund } from "@/pos-mobile/8-kitchen/lib/createPosKitchenTickets";
import {
  POS_KITCHEN_COMPLETED_TODAY_QUERY_KEY,
  POS_KITCHEN_RECALL_QUERY_KEY,
  POS_KITCHEN_TICKETS_QUERY_KEY,
} from "@/pos-mobile/8-kitchen/lib/posKitchenTypes";
import {
  prepareRefundStockDecision,
  POS_REFUND_WASTE_REASON_REQUIRED,
  type RefundStockPolicy,
} from "../lib/refund";
import { POS_REFUND_STOCK_POLICY_QUERY_KEY } from "./usePosRefundStockPolicy";

export type PosCheckoutRefundInput = {
  activityId: string;
  sessionId?: string | null;
  outletId?: string | null;
  reverseId?: string;
  reason?: string | null;
  shiftId?: string | null;
};

export type PosCheckoutRefundResult = {
  stockReversed: boolean;
  kitchenReversed: boolean;
  activityRolledBack: boolean;
  kitchenVoidError: string | null;
  effectiveStockPolicy: RefundStockPolicy;
  ledger: Awaited<ReturnType<typeof posRefundStoreCheckout>>;
};

export function usePosCheckoutRefund() {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: PosCheckoutRefundInput): Promise<PosCheckoutRefundResult> => {
      if (!organizationId) throw new Error("Organization ID is required");
      if (!input.activityId?.trim()) {
        throw new Error("pos_refund_activity_required");
      }

      const reverseId = input.reverseId ?? `refund-${input.activityId}`;
      const decision = await prepareRefundStockDecision({
        sessionId: input.sessionId,
        reason: input.reason,
      });

      const stock = await reversePaidCheckoutStock({
        organizationId,
        activityId: input.activityId,
        sessionId: input.sessionId,
        outletId: input.outletId,
        reverseId,
        rollbackActivity: false,
        skipStockReverse: decision.skipStockReverse,
      });

      const ledger = await posRefundStoreCheckout({
        activityId: input.activityId,
        reason: decision.ledgerReason,
        shiftId: input.shiftId,
        reverseId,
      });

      let kitchenVoidError: string | null = null;
      const sessionId = input.sessionId?.trim();
      if (sessionId) {
        try {
          await voidKitchenTicketsForRefund(sessionId);
        } catch (err) {
          kitchenVoidError = err instanceof Error ? err.message : String(err);
        }
      }

      return {
        ...stock,
        ledger,
        kitchenVoidError,
        effectiveStockPolicy: decision.effectiveStockPolicy,
      };
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
      void queryClient.invalidateQueries({ queryKey: [POS_KITCHEN_TICKETS_QUERY_KEY] });
      void queryClient.invalidateQueries({ queryKey: [POS_KITCHEN_RECALL_QUERY_KEY] });
      void queryClient.invalidateQueries({ queryKey: [POS_KITCHEN_COMPLETED_TODAY_QUERY_KEY] });
    },
    onError: (err) => {
      const message = err instanceof Error ? err.message : String(err);
      if (message === POS_REFUND_WASTE_REASON_REQUIRED) {
        void queryClient.invalidateQueries({
          queryKey: [POS_REFUND_STOCK_POLICY_QUERY_KEY],
        });
      }
    },
  });
}
