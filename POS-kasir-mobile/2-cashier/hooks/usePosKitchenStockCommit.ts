import type { CustomerVisitCartLine } from "@/5-2-customer-visits/checkout/lib/customerVisitCheckout.types";
import { printPosOrderTickets } from "@/pos-mobile/shared/printing/posPrintService";
import { getPosTicketPrintPrefs } from "@/pos-mobile/shared/printing/posPrintService";
import { commitKitchenStockIfNeeded } from "@/stock-management/stock-commit/lib/stockCommitOrchestrator";
import { resolveStockCommitPolicy } from "@/stock-management/stock-commit/lib/resolveStockCommitPolicy";
import { computeCommitDelta } from "@/stock-management/stock-commit/lib/computeCommitDelta";
import { fetchSessionStockCommits } from "@/stock-management/stock-commit/hooks/usePosSessionStockCommits";

export type CommitKitchenStockAndPrintArgs = {
  organizationId: string;
  outletId: string;
  outletName: string;
  sessionId: string;
  cartLines: CustomerVisitCartLine[];
  customerName?: string | null;
  /** When false, skip print (commit only). */
  printTickets?: boolean;
};

export type CommitKitchenStockAndPrintResult = {
  committed: boolean;
  printed: boolean;
  deltaCount: number;
  printError?: Error;
};

async function printKitchenTickets(args: {
  outletId: string;
  outletName: string;
  printLines: CustomerVisitCartLine[];
  customerName?: string | null;
}): Promise<void> {
  const lines = args.printLines.filter((l) => !l.isCustomAmount);
  if (lines.length === 0) return;
  await printPosOrderTickets({
    outletId: args.outletId,
    outletName: args.outletName,
    lines,
    customerName: args.customerName,
  });
}

/** Commit DB first, then print order tickets (Q20). */
export async function commitKitchenStockAndPrint(
  args: CommitKitchenStockAndPrintArgs,
): Promise<CommitKitchenStockAndPrintResult> {
  const commitPoint = await resolveStockCommitPolicy({
    organizationId: args.organizationId,
    outletId: args.outletId,
  });

  const commits = await fetchSessionStockCommits(args.sessionId);
  const deltas = computeCommitDelta(args.cartLines, commits);
  const printLines =
    deltas.length > 0
      ? deltas.map((d) => ({ ...d.line, quantity: d.deltaQty }))
      : args.cartLines;

  if (commitPoint !== "kitchen") {
    if (args.printTickets === false) {
      return { committed: false, printed: false, deltaCount: 0 };
    }
    try {
      await printKitchenTickets({
        outletId: args.outletId,
        outletName: args.outletName,
        printLines,
        customerName: args.customerName,
      });
      return { committed: false, printed: true, deltaCount: deltas.length };
    } catch (printErr) {
      return {
        committed: false,
        printed: false,
        deltaCount: deltas.length,
        printError: printErr instanceof Error ? printErr : new Error(String(printErr)),
      };
    }
  }

  const result = await commitKitchenStockIfNeeded({
    organizationId: args.organizationId,
    outletId: args.outletId,
    sessionId: args.sessionId,
    cartLines: args.cartLines,
    commitPoint,
    existingCommits: commits,
  });

  if (args.printTickets === false) {
    return { committed: result.committed, printed: false, deltaCount: result.deltaCount };
  }

  if (printLines.filter((l) => !l.isCustomAmount).length === 0) {
    return { committed: result.committed, printed: false, deltaCount: result.deltaCount };
  }

  try {
    await printKitchenTickets({
      outletId: args.outletId,
      outletName: args.outletName,
      printLines,
      customerName: args.customerName,
    });
    return {
      committed: result.committed,
      printed: true,
      deltaCount: result.deltaCount,
    };
  } catch (printErr) {
    return {
      committed: result.committed,
      printed: false,
      deltaCount: result.deltaCount,
      printError: printErr instanceof Error ? printErr : new Error(String(printErr)),
    };
  }
}

export function shouldKitchenCommitOnPay(outletId: string | null): boolean {
  if (!outletId) return false;
  return getPosTicketPrintPrefs(outletId).printTicketOnPay;
}
