import type { CatalogCheckoutTotals } from "@/8-2-1-default-prices/checkout/lib/computeCatalogCheckoutTotals";
import type { CustomerVisitCartLine } from "@/5-2-customer-visits/checkout/lib/customerVisitCheckout.types";
import {
  getPosTicketPrintPrefs,
  printPosOrderTickets,
  printPosReceiptBill,
} from "@/pos-mobile/shared/printing/posPrintService";
import type { PosCheckoutPrintLock } from "./posCheckoutPrintLock";

export type PosCheckoutReceiptInput = {
  lines: CustomerVisitCartLine[];
  checkoutTotals: CatalogCheckoutTotals;
  customerName?: string | null;
};

export type RunPosCheckoutSideEffectsArgs = {
  outletId: string;
  outletName: string;
  cartLines: CustomerVisitCartLine[];
  kitchenPrintLines?: CustomerVisitCartLine[] | null;
  receipt?: PosCheckoutReceiptInput | null;
  printLock: PosCheckoutPrintLock;
  receiptKey: string;
  onKitchenPrinted?: () => void;
  onKitchenPrintError?: (err: unknown) => void;
  onReceiptError?: (err: unknown) => void;
};

/**
 * After Change: print kitchen tickets then receipt.
 * KDS tickets are already in the database. Never throws — do not roll back a sale.
 */
export async function runPosCheckoutSideEffects(
  args: RunPosCheckoutSideEffectsArgs,
): Promise<void> {
  await args.printLock.enqueue(async () => {
    const kitchenLines = (args.kitchenPrintLines ?? []).filter(
      (line) => !line.isCustomAmount,
    );
    if (kitchenLines.length > 0) {
      try {
        await printPosOrderTickets({
          outletId: args.outletId,
          outletName: args.outletName,
          lines: kitchenLines,
          customerName: args.receipt?.customerName,
        });
        args.onKitchenPrinted?.();
      } catch (err) {
        args.onKitchenPrintError?.(err);
      }
    }

    const prefs = getPosTicketPrintPrefs(args.outletId);
    if (
      args.receipt &&
      prefs.hasReceiptPrinter &&
      args.cartLines.length > 0 &&
      !args.printLock.alreadyPrinted(args.receiptKey)
    ) {
      try {
        await printPosReceiptBill({
          outletId: args.outletId,
          outletName: args.outletName,
          lines: args.receipt.lines,
          checkoutTotals: args.receipt.checkoutTotals,
          customerName: args.receipt.customerName,
          isBillDraft: false,
        });
        args.printLock.markReceipt(args.receiptKey, true);
      } catch (err) {
        args.printLock.markReceipt(args.receiptKey, false);
        args.onReceiptError?.(err);
      }
    }
  });
}
