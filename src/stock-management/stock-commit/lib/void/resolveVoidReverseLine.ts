import type { CustomerVisitCartLine } from "@/5-2-customer-visits/checkout/lib/customerVisitCheckout.types";
import type { PosSessionStockCommit } from "../../types/sessionStockCommit";
import { cartLineCommitFingerprint } from "../computeCommitDelta";

export type VoidReverseLineResolved = {
  lineFingerprint: string;
  reverseQty: number;
  lineIndex: number;
};

/**
 * Resolve void reverse qty + stable line_index from the session commit ledger
 * (not from re-indexing a single cart line, which always yields L1).
 */
export function resolveVoidReverseLine(args: {
  line: CustomerVisitCartLine;
  voidQty: number;
  commits: PosSessionStockCommit[];
}): VoidReverseLineResolved | null {
  const lineFingerprint = cartLineCommitFingerprint(args.line);
  const commit = args.commits.find((c) => c.line_fingerprint === lineFingerprint);
  if (!commit || commit.committed_qty <= 0) return null;

  const reverseQty = Math.min(args.voidQty, Number(commit.committed_qty) || 0);
  if (reverseQty <= 0) return null;

  const lineIndex = Math.max(1, Number(commit.line_index) || 1);

  return { lineFingerprint, reverseQty, lineIndex };
}
