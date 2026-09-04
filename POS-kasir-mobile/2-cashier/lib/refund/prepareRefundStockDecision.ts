import { formatRefundLedgerReason } from "./formatRefundWasteReason";
import { loadRefundStockPolicy } from "./loadKitchenTicketsForRefund";
import {
  assertRefundWasteReason,
  type RefundStockPolicy,
} from "./resolveRefundStockPolicy";

export type PreparedRefundStockDecision = {
  effectiveStockPolicy: RefundStockPolicy;
  skipStockReverse: boolean;
  ledgerReason: string | null;
};

/** Pure step after live policy is known (used by mutation + unit tests). */
export function prepareRefundStockDecisionFromPolicy(
  effectiveStockPolicy: RefundStockPolicy,
  reason: string | null | undefined,
): PreparedRefundStockDecision {
  assertRefundWasteReason(effectiveStockPolicy, reason);
  return {
    effectiveStockPolicy,
    skipStockReverse: effectiveStockPolicy === "waste",
    ledgerReason: formatRefundLedgerReason(effectiveStockPolicy, reason),
  };
}

/**
 * Load kitchen tickets and decide restore vs waste immediately before stock reverse.
 * Throws on DB failure (fail closed) or missing waste reason.
 */
export async function prepareRefundStockDecision(args: {
  sessionId?: string | null;
  reason?: string | null;
}): Promise<PreparedRefundStockDecision> {
  const effectiveStockPolicy = await loadRefundStockPolicy(args.sessionId);
  return prepareRefundStockDecisionFromPolicy(effectiveStockPolicy, args.reason);
}
