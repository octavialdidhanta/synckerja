import { cartLineFingerprint } from "@/pos-mobile/2-cashier/lib/cartLineFingerprint";
import type { CustomerVisitCartLine } from "@/5-2-customer-visits/checkout/lib/customerVisitCheckout.types";
import type { PosSessionStockCommit } from "../types/sessionStockCommit";

export type CommitDeltaLine = {
  line: CustomerVisitCartLine;
  lineIndex: number;
  lineFingerprint: string;
  deltaQty: number;
  committedQty: number;
  cartQty: number;
};

export function cartLineCommitFingerprint(line: CustomerVisitCartLine): string {
  return cartLineFingerprint(line);
}

/** Index lines 1-based for stable L{n} reference keys. */
export function indexCartLines(lines: CustomerVisitCartLine[]): Array<{
  line: CustomerVisitCartLine;
  lineIndex: number;
  lineFingerprint: string;
}> {
  return lines
    .filter((line) => !line.isCustomAmount && line.kind === "product")
    .map((line, idx) => ({
      line,
      lineIndex: idx + 1,
      lineFingerprint: cartLineCommitFingerprint(line),
    }));
}

export function computeCommitDelta(
  cartLines: CustomerVisitCartLine[],
  commits: PosSessionStockCommit[],
): CommitDeltaLine[] {
  const commitByFp = new Map<string, PosSessionStockCommit>();
  for (const c of commits) {
    commitByFp.set(c.line_fingerprint, c);
  }

  const deltas: CommitDeltaLine[] = [];
  for (const { line, lineIndex, lineFingerprint } of indexCartLines(cartLines)) {
    const cartQty = Number(line.quantity) || 0;
    if (cartQty <= 0) continue;

    const committed = commitByFp.get(lineFingerprint);
    const committedQty = committed ? Number(committed.committed_qty) || 0 : 0;
    const deltaQty = cartQty - committedQty;
    if (deltaQty <= 0) continue;

    deltas.push({
      line,
      lineIndex,
      lineFingerprint,
      deltaQty,
      committedQty,
      cartQty,
    });
  }

  return deltas;
}

/** Build delta lines for void reverse (qty reduced on open bill). */
export function computeVoidReverseDelta(args: {
  line: CustomerVisitCartLine;
  voidQty: number;
  commits: PosSessionStockCommit[];
}): { lineFingerprint: string; reverseQty: number } | null {
  const fp = cartLineCommitFingerprint(args.line);
  const commit = args.commits.find((c) => c.line_fingerprint === fp);
  if (!commit || commit.committed_qty <= 0) return null;
  const reverseQty = Math.min(args.voidQty, commit.committed_qty);
  if (reverseQty <= 0) return null;
  return { lineFingerprint: fp, reverseQty };
}
