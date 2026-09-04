import type { CustomerVisitCartLine } from "@/5-2-customer-visits/checkout/lib/customerVisitCheckout.types";
import { supabase } from "@/shared/lib/supabaseClient";
import { commitKitchenStockAndPrint } from "@/pos-mobile/2-cashier/hooks/usePosKitchenStockCommit";
import { getPosTicketPrintPrefs } from "@/pos-mobile/shared/printing/posPrintService";
import { printPosOrderTickets } from "@/pos-mobile/shared/printing/posPrintService";
import {
  computeKitchenFireDelta,
  kitchenFireDeltaToCartLines,
} from "./computeKitchenFireDelta";
import { createPosKitchenTickets } from "./createPosKitchenTickets";
import { fetchKitchenFiredQtyByFingerprint } from "./fetchKitchenFiredFingerprints";
import {
  DEFAULT_KITCHEN_FIRE_BY_SALES_TYPE,
  shouldFireKitchen,
  shouldFireKitchenOnPay,
  type KitchenFireBySalesType,
  type KitchenFireTrigger,
} from "./kitchenFirePolicy";
import { loadKitchenFirePolicy } from "./loadKitchenFirePolicy";
import { shouldPrintKitchenTicketOnFire } from "./shouldPrintKitchenTicketOnFire";

export type FireKitchenForCheckoutArgs = {
  organizationId: string;
  outletId: string;
  outletName: string;
  sessionId: string;
  cartLines: CustomerVisitCartLine[];
  salesTypeLabel: string | null | undefined;
  salesTypeId?: string | null;
  tableName: string;
  posTableId?: string | null;
  customerName?: string | null;
  createdBy?: string | null;
  /** Which checkout event is firing (save_bill vs on_pay). */
  event: KitchenFireTrigger;
  /** Pre-loaded policy; loads from DB when omitted. */
  firePolicy?: KitchenFireBySalesType;
  /** For on_pay: whether KDS already had tickets before this pay. */
  hadKitchenTicketsBeforePay?: boolean;
  /**
   * When false, insert KDS tickets + recipe stock but skip Bluetooth.
   * Caller may print `pendingPrintLines` after the success screen.
   */
  printTickets?: boolean;
};

export type FireKitchenForCheckoutResult = {
  fired: boolean;
  ticketId: string | null;
  stockCommitted: boolean;
  printed: boolean;
  /** Set when print was skipped so the checkout side-effect runner can print later. */
  pendingPrintLines: CustomerVisitCartLine[];
};

function shouldFireForEvent(args: FireKitchenForCheckoutArgs): boolean {
  const settings = args.firePolicy ?? DEFAULT_KITCHEN_FIRE_BY_SALES_TYPE;
  if (args.event === "save_bill") {
    return shouldFireKitchen({
      event: "save_bill",
      salesTypeLabel: args.salesTypeLabel,
      settings,
    });
  }
  return shouldFireKitchenOnPay({
    salesTypeLabel: args.salesTypeLabel,
    settings,
    hadKitchenTicketsBeforePay: args.hadKitchenTicketsBeforePay ?? false,
  });
}

/**
 * Resolve policy, compute delta, insert KDS ticket, commit kitchen stock, optional print.
 */
export async function fireKitchenForCheckout(
  args: FireKitchenForCheckoutArgs,
): Promise<FireKitchenForCheckoutResult> {
  const policy =
    args.firePolicy ??
    (await loadKitchenFirePolicy(args.organizationId, args.outletId));

  const argsWithPolicy = { ...args, firePolicy: policy };
  if (!shouldFireForEvent(argsWithPolicy)) {
    return {
      fired: false,
      ticketId: null,
      stockCommitted: false,
      printed: false,
      pendingPrintLines: [],
    };
  }

  const firedMap = await fetchKitchenFiredQtyByFingerprint(args.sessionId);
  const deltas = computeKitchenFireDelta(args.cartLines, firedMap);
  const deltaLines = kitchenFireDeltaToCartLines(deltas);
  if (deltaLines.length === 0) {
    return {
      fired: false,
      ticketId: null,
      stockCommitted: false,
      printed: false,
      pendingPrintLines: [],
    };
  }

  const ticketId = await createPosKitchenTickets({
    organizationId: args.organizationId,
    outletId: args.outletId,
    sessionId: args.sessionId,
    posTableId: args.posTableId ?? null,
    tableName: args.tableName,
    cartLines: deltaLines,
    createdBy: args.createdBy ?? null,
    customerName: args.customerName ?? null,
    salesTypeId: args.salesTypeId ?? null,
    salesTypeLabel: args.salesTypeLabel ?? null,
  });

  const prefs = getPosTicketPrintPrefs(args.outletId);
  const shouldPrint = shouldPrintKitchenTicketOnFire(args.event, prefs.printTicketOnPay);
  const skipBluetooth = args.printTickets === false;

  // Always commit recipe stock when a KDS ticket is created (Dapur mode).
  // Print remains optional so KDS-only outlets still deduct Pustaka.
  const result = await commitKitchenStockAndPrint({
    organizationId: args.organizationId,
    outletId: args.outletId,
    outletName: args.outletName,
    sessionId: args.sessionId,
    cartLines: deltaLines,
    customerName: args.customerName,
    printTickets: skipBluetooth ? false : shouldPrint,
  });
  let stockCommitted = result.committed;
  let printed = result.printed;
  if (
    !skipBluetooth &&
    shouldPrint &&
    !printed &&
    !result.printError &&
    (args.event !== "on_pay" || prefs.hasTicketPrinter)
  ) {
    try {
      await printPosOrderTickets({
        outletId: args.outletId,
        outletName: args.outletName,
        lines: deltaLines.filter((l) => !l.isCustomAmount),
        customerName: args.customerName,
      });
      printed = true;
    } catch {
      /* caller may toast */
    }
  }

  return {
    fired: Boolean(ticketId),
    ticketId,
    stockCommitted,
    printed,
    pendingPrintLines:
      skipBluetooth && shouldPrint
        ? deltaLines.filter((line) => !line.isCustomAmount)
        : [],
  };
}

/** Link sales_activity to a pay-first session created without prior open state. */
export async function linkPayFirstSessionActivity(
  sessionId: string,
  salesActivityId: string,
  closedBy?: string | null,
): Promise<void> {
  const { error } = await supabase
    .from("pos_table_sessions")
    .update({
      sales_activity_id: salesActivityId,
      closed_by: closedBy ?? null,
    })
    .eq("id", sessionId);
  if (error) throw error;
}
