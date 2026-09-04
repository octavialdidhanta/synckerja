import type { CustomerVisitCartLine } from "@/5-2-customer-visits/checkout/lib/customerVisitCheckout.types";
import type { KitchenFireBySalesType } from "@/pos-mobile/8-kitchen/lib/kitchenFirePolicy";
import { sessionHasKitchenTickets } from "@/pos-mobile/8-kitchen/lib/fetchKitchenFiredFingerprints";
import { loadKitchenFirePolicy } from "@/pos-mobile/8-kitchen/lib/loadKitchenFirePolicy";
import type { FireKitchenForCheckoutResult } from "@/pos-mobile/8-kitchen/lib/fireKitchenForCheckout";
import { shouldAutoDoneKitchenOnPay } from "@/pos-mobile/8-kitchen/lib/shouldAutoDoneKitchenOnPay";
import { markKitchenTicketsDoneForSession } from "@/pos-mobile/8-kitchen/lib/createPosKitchenTickets";
import { POS_SETTINGS_I18N } from "@/pos-mobile/3-settings/lib/posSettingsCopy";
import type { PosCashierPayInput } from "../hooks/usePosCashierPay";
import { POS_STOCK_COMMIT_I18N } from "../lib/posStockCommitCopy";

type TranslateFn = (
  key: string,
  fallback?: string,
  variables?: Record<string, string | number>,
) => string;

export type KitchenPayCheckoutContext = NonNullable<PosCashierPayInput["kitchenCheckout"]>;

export async function buildKitchenPayCheckoutContext(args: {
  organizationId: string;
  outletId: string;
  outletName: string;
  sessionId: string | null;
  tableName: string;
  salesTypeLabel: string;
  salesTypeId?: string | null;
  customerName?: string | null;
}): Promise<KitchenPayCheckoutContext> {
  const hadKitchenTicketsBeforePay = args.sessionId
    ? await sessionHasKitchenTickets(args.sessionId)
    : false;

  const firePolicy = await loadKitchenFirePolicy(args.organizationId, args.outletId);

  return {
    outletName: args.outletName,
    tableName: args.tableName,
    salesTypeLabel: args.salesTypeLabel,
    customerName: args.customerName ?? null,
    hadKitchenTicketsBeforePay,
    sessionWasOpenBeforePay: Boolean(args.sessionId),
    firePolicy,
  };
}

export function toastKitchenFireResult(args: {
  result: FireKitchenForCheckoutResult;
  t: TranslateFn;
  toast: (opts: {
    title: string;
    description?: string;
    variant?: "default" | "destructive";
  }) => void;
}): void {
  const { result, t, toast } = args;
  if (result.stockCommitted) {
    toast({
      title: t(POS_STOCK_COMMIT_I18N.kitchenCommitted, "Kitchen stock committed"),
    });
  }
  if (result.printed) {
    toast({ title: t(POS_SETTINGS_I18N.printerTicketPrinted, "Order ticket printed") });
  }
}

export async function applyKitchenAutoDoneOnPay(args: {
  sessionId: string;
  kitchenCheckout: KitchenPayCheckoutContext;
}): Promise<void> {
  const autoDone = shouldAutoDoneKitchenOnPay({
    hadKitchenTicketsBeforePay: args.kitchenCheckout.hadKitchenTicketsBeforePay,
    sessionWasOpenBeforePay: args.kitchenCheckout.sessionWasOpenBeforePay,
    salesTypeLabel: args.kitchenCheckout.salesTypeLabel,
    settings: args.kitchenCheckout.firePolicy,
  });
  if (!autoDone) return;
  try {
    await markKitchenTicketsDoneForSession(args.sessionId);
  } catch (kdsErr) {
    console.error("markKitchenTicketsDoneForSession failed", kdsErr);
  }
}

export type RunKitchenFireOnPayArgs = {
  organizationId: string;
  outletId: string;
  outletName: string;
  sessionId: string | null;
  cartLines: CustomerVisitCartLine[];
  salesTypeId?: string | null;
  posTableId?: string | null;
  clientPhone?: string | null;
  servedByUserId?: string | null;
  salesActivityId: string;
  closedBy?: string | null;
  keepPayFirstSessionOpen?: boolean;
  kitchenCheckout: KitchenPayCheckoutContext;
  /** Skip Bluetooth; KDS tickets + recipe stock still run. */
  printTickets?: boolean;
};

/** Fire KDS on pay; returns session id (may create pay-first walk-in session). */
export async function runKitchenFireOnPay(
  args: RunKitchenFireOnPayArgs,
): Promise<{ sessionId: string | null; result: FireKitchenForCheckoutResult }> {
  const { ensurePayFirstKitchenSession } = await import("./ensurePayFirstKitchenSession");
  const { fireKitchenForCheckout } = await import(
    "@/pos-mobile/8-kitchen/lib/fireKitchenForCheckout"
  );

  let sessionId = args.sessionId;
  if (!sessionId) {
    sessionId = await ensurePayFirstKitchenSession({
      organizationId: args.organizationId,
      outletId: args.outletId,
      tableName: args.kitchenCheckout.tableName,
      posTableId: args.posTableId ?? null,
      customerName: args.kitchenCheckout.customerName,
      customerPhone: args.clientPhone ?? null,
      salesActivityId: args.salesActivityId,
      closedBy: args.closedBy ?? null,
      waiterId: args.servedByUserId ?? null,
      keepOpen: Boolean(args.keepPayFirstSessionOpen),
    });
  }

  const result = await fireKitchenForCheckout({
    organizationId: args.organizationId,
    outletId: args.outletId,
    outletName: args.outletName,
    sessionId,
    cartLines: args.cartLines,
    event: "on_pay",
    salesTypeLabel: args.kitchenCheckout.salesTypeLabel,
    salesTypeId: args.salesTypeId ?? null,
    tableName: args.kitchenCheckout.tableName,
    posTableId: args.posTableId ?? null,
    customerName: args.kitchenCheckout.customerName,
    hadKitchenTicketsBeforePay: args.kitchenCheckout.hadKitchenTicketsBeforePay,
    firePolicy: args.kitchenCheckout.firePolicy,
    printTickets: args.printTickets,
  });

  return { sessionId, result };
}
