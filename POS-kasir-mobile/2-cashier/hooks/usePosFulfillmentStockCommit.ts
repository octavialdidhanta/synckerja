import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import {
  applyCatalogFulfillmentStock,
  releaseCatalogStockReserve,
} from "@/stock-management/stock-commit/rpc/applyCatalogStockReserve";
import { fulfillmentRpcLinesFromCart } from "@/stock-management/stock-commit/lib/buildCommitLinesPayload";
import { resolveStockCommitPolicy } from "@/stock-management/stock-commit/lib/resolveStockCommitPolicy";
import type { CustomerVisitCartLine } from "@/5-2-customer-visits/checkout/lib/customerVisitCheckout.types";
import { POS_SESSION_STOCK_COMMITS_QUERY_KEY } from "@/stock-management/stock-commit/hooks/usePosSessionStockCommits";
import { POS_TABLE_SESSIONS_QUERY_KEY } from "@/8-2-9-table-management/hooks/usePosTableSessions";
import { invalidateCatalogStockCaches } from "@/8-2-3-ingredient/library/hooks/invalidateCatalogStockCaches";

export function usePosFulfillmentStockCommit() {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (args: {
      outletId: string;
      sessionId: string;
      cartLines: CustomerVisitCartLine[];
    }) => {
      if (!organizationId) throw new Error("Organization ID is required");
      const commitPoint = await resolveStockCommitPolicy({
        organizationId,
        outletId: args.outletId,
      });
      if (commitPoint !== "fulfillment") {
        throw new Error("pos_fulfillment_not_enabled");
      }
      const lines = fulfillmentRpcLinesFromCart(args.cartLines);
      if (lines.length === 0) return;
      await applyCatalogFulfillmentStock({
        organizationId,
        outletId: args.outletId,
        sessionId: args.sessionId,
        lines,
      });
      await releaseCatalogStockReserve({
        organizationId,
        outletId: args.outletId,
        sessionId: args.sessionId,
        lines: lines.map((l) => ({
          product_id: l.product_id,
          qty: l.qty,
          variant_id: l.variant_id,
        })),
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [POS_TABLE_SESSIONS_QUERY_KEY] });
      void queryClient.invalidateQueries({ queryKey: [POS_SESSION_STOCK_COMMITS_QUERY_KEY] });
      void invalidateCatalogStockCaches(queryClient, organizationId);
    },
  });
}
