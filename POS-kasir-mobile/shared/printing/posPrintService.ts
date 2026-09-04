import type { CatalogCheckoutTotals } from "@/8-2-1-default-prices/checkout/lib/computeCatalogCheckoutTotals";
import type { CustomerVisitCartLine } from "@/5-2-customer-visits/checkout/lib/customerVisitCheckout.types";
import { readPosPrinterSettings } from "@/pos-mobile/3-settings/lib/printer/posPrinterStorage";
import type {
  PosPrinterRole,
  PosSavedPrinter,
} from "@/pos-mobile/3-settings/lib/printer/posPrinterTypes";
import { resolvePosPrinterBridge } from "./bridges/CapacitorBluetoothPrinterBridge";
import { PosPrinterUnavailableError } from "./PosPrinterBridge";
import { buildOrderTicketEscPosPayloads } from "./escpos/buildOrderTicketEscPos";
import { buildReceiptEscPos } from "./escpos/buildReceiptEscPos";
import {
  buildShiftReportEscPos,
  type PosShiftReportPrintInput,
} from "./escpos/buildShiftReportEscPos";
import { buildQrisSlipEscPos } from "./escpos/buildQrisSlipEscPos";
import { buildTestPrintEscPos } from "./escpos/buildTestPrintEscPos";
import { posPrinterDisplayName } from "@/pos-mobile/3-settings/lib/printer/posPrinterRoleLabels";

export type PosPrintCartLine = CustomerVisitCartLine & {
  productCategoryId?: string | null;
};

async function printToPrinter(printer: PosSavedPrinter, bytes: Uint8Array): Promise<void> {
  const bridge = resolvePosPrinterBridge();
  const available = await bridge.isAvailable();
  if (!available) throw new PosPrinterUnavailableError();
  // Discovery holds the radio; cancel before RFCOMM connect.
  try {
    await bridge.stopDiscovery();
  } catch {
    /* ignore */
  }
  await bridge.connect(printer.address);
  try {
    await bridge.printRaw(bytes);
  } finally {
    try {
      await bridge.disconnect();
    } catch {
      /* ignore */
    }
  }
}

/** Connect + print a short test slip to the given saved printer (ignores roles). */
export async function printPosTestPage(args: {
  printer: PosSavedPrinter;
  outletName?: string | null;
}): Promise<void> {
  const bytes = buildTestPrintEscPos({
    printerName: posPrinterDisplayName(args.printer),
    outletName: args.outletName,
  });
  await printToPrinter(args.printer, bytes);
}

function printersForRole(
  printers: PosSavedPrinter[],
  role: Extract<PosPrinterRole, "receipt_bill" | "order_ticket" | "shift_recap">,
): PosSavedPrinter[] {
  return printers.filter((p) => p.roles[role]);
}

export async function printPosReceiptBill(args: {
  outletId: string;
  outletName: string;
  lines: PosPrintCartLine[];
  checkoutTotals: CatalogCheckoutTotals;
  customerName?: string | null;
  isBillDraft?: boolean;
}): Promise<void> {
  const settings = readPosPrinterSettings(args.outletId);
  const targets = printersForRole(settings.printers, "receipt_bill");
  if (targets.length === 0) {
    throw new Error("no_receipt_printer");
  }
  const bytes = buildReceiptEscPos({
    outletName: args.outletName,
    lines: args.lines,
    checkoutTotals: args.checkoutTotals,
    customerName: args.customerName,
    isBillDraft: args.isBillDraft,
  });
  await printToPrinter(targets[0], bytes);
}

export async function printPosOrderTickets(args: {
  outletId: string;
  outletName: string;
  lines: PosPrintCartLine[];
  customerName?: string | null;
}): Promise<void> {
  const settings = readPosPrinterSettings(args.outletId);
  const targets = printersForRole(settings.printers, "order_ticket");
  if (targets.length === 0) {
    throw new Error("no_ticket_printer");
  }
  const printer = targets[0];
  const perProduct = settings.printTicketPerProduct;
  const payloads = buildOrderTicketEscPosPayloads(
    {
      outletName: args.outletName,
      lines: args.lines,
      customerName: args.customerName,
      perProduct,
    },
    printer.categoryIdsForTicket,
  );
  if (payloads.length === 0) return;

  const copies = settings.ticketCopies;
  for (let c = 0; c < copies; c++) {
    for (const payload of payloads) {
      await printToPrinter(printer, payload);
    }
  }
}

export async function printPosShiftReport(
  args: PosShiftReportPrintInput & { outletId: string },
): Promise<void> {
  const settings = readPosPrinterSettings(args.outletId);
  const shiftTargets = printersForRole(settings.printers, "shift_recap");
  const fallback = printersForRole(settings.printers, "receipt_bill");
  const targets = shiftTargets.length > 0 ? shiftTargets : fallback;
  if (targets.length === 0) {
    throw new Error("no_shift_printer");
  }
  const bytes = buildShiftReportEscPos(args);
  await printToPrinter(targets[0], bytes);
}

export async function printPosQrisSlip(args: {
  outletId: string;
  outletName: string;
  outletAddress?: string | null;
  amountLabel: string;
  qrString: string;
}): Promise<void> {
  const settings = readPosPrinterSettings(args.outletId);
  const targets = printersForRole(settings.printers, "receipt_bill");
  if (targets.length === 0) {
    throw new Error("no_receipt_printer");
  }
  const bytes = buildQrisSlipEscPos({
    outletName: args.outletName,
    outletAddress: args.outletAddress,
    amountLabel: args.amountLabel,
    qrString: args.qrString,
  });
  await printToPrinter(targets[0], bytes);
}

export function getPosTicketPrintPrefs(outletId: string) {
  const settings = readPosPrinterSettings(outletId);
  return {
    printTicketOnPay: settings.printTicketOnPay,
    printTicketPerProduct: settings.printTicketPerProduct,
    ticketCopies: settings.ticketCopies,
    hasTicketPrinter: settings.printers.some((p) => p.roles.order_ticket),
    hasReceiptPrinter: settings.printers.some((p) => p.roles.receipt_bill),
    hasShiftPrinter: settings.printers.some(
      (p) => p.roles.shift_recap || p.roles.receipt_bill,
    ),
  };
}
