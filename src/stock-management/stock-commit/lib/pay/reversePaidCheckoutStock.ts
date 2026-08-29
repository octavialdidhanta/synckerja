import { rollbackStoreCheckoutSalesActivity } from "@/5-2-customer-visits/checkout/lib/createStoreCheckoutSalesActivity";
import { reverseStoreCheckoutStock } from "../../rpc/applyCatalogStockReserve";
import { reverseCatalogKitchenCommit } from "../../rpc/applyCatalogKitchenCommitStock";
import { resolveStockCommitPolicy } from "../resolveStockCommitPolicy";

export type ReversePaidCheckoutResult = {
  stockReversed: boolean;
  kitchenReversed: boolean;
  activityRolledBack: boolean;
};

export async function reversePaidCheckoutStock(args: {
  organizationId: string;
  activityId: string;
  reverseId?: string;
  rollbackActivity?: boolean;
  sessionId?: string | null;
  outletId?: string | null;
}): Promise<ReversePaidCheckoutResult> {
  const activityId = args.activityId?.trim();
  if (!activityId) {
    throw new Error("pos_refund_activity_required");
  }

  const reverseId = args.reverseId ?? `refund-${activityId}`;

  await reverseStoreCheckoutStock({
    organizationId: args.organizationId,
    activityId,
    reverseId,
  });

  let kitchenReversed = false;
  if (args.sessionId && args.outletId) {
    const commitPoint = await resolveStockCommitPolicy({
      organizationId: args.organizationId,
      outletId: args.outletId,
    });
    if (commitPoint === "kitchen") {
      await reverseCatalogKitchenCommit({
        organizationId: args.organizationId,
        sessionId: args.sessionId,
        reverseId: `${reverseId}-kitchen`,
        lines: null,
      });
      kitchenReversed = true;
    }
  }

  let activityRolledBack = false;
  if (args.rollbackActivity !== false) {
    await rollbackStoreCheckoutSalesActivity(activityId);
    activityRolledBack = true;
  }

  return {
    stockReversed: true,
    kitchenReversed,
    activityRolledBack,
  };
}
