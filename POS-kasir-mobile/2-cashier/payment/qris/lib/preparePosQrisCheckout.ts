import { supabase } from "@/shared/lib/supabaseClient";
import {
  assertStockForPayLines,
  resolvePayStockScopedLines,
} from "@/stock-management/stock-commit/lib/stockCommitOrchestrator";
import { resolvePosShiftForPay } from "@/pos-mobile/4-shift/lib/usePosCashierShift";
import {
  durationMinutesSince,
  findOpenSessionForTable,
} from "@/8-2-9-table-management/hooks/usePosTableSessions";
import type { CustomerVisitCartLine } from "@/5-2-customer-visits/checkout/lib/customerVisitCheckout.types";
import type { CatalogCheckoutTotals } from "@/8-2-1-default-prices/checkout/lib/computeCatalogCheckoutTotals";
import type { BuildPendingCheckoutPayloadArgs } from "@/shared/pos-qris/lib/buildPendingCheckoutPayload";
import { ensurePosCheckoutLead } from "@/5-2-customer-visits/checkout/pos-bind";

export type PreparePosQrisCheckoutInput = {
  organizationId: string;
  outletId: string;
  clientName: string;
  clientPhone: string | null;
  catalogLines: CustomerVisitCartLine[];
  paidCatalogTotals: CatalogCheckoutTotals;
  salesTypeId?: string | null;
  tableNumber?: string | null;
  posTableId?: string | null;
  sessionId?: string | null;
  seatedAt?: string | null;
  servedByUserId?: string | null;
  keepSessionOpen?: boolean;
  remainderCartLines?: CustomerVisitCartLine[] | null;
  paymentChannelId?: string | null;
};

export async function preparePosQrisCheckout(
  input: PreparePosQrisCheckoutInput,
): Promise<{
  checkout: BuildPendingCheckoutPayloadArgs;
  leadId: string;
  posShiftId: string | null;
  boundByPhone: boolean;
}> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let sessionId = input.sessionId ?? null;
  let seatedAt = input.seatedAt ?? null;
  if (input.posTableId && !sessionId) {
    try {
      const open = await findOpenSessionForTable({
        organizationId: input.organizationId,
        posTableId: input.posTableId,
      });
      if (open) {
        sessionId = open.id;
        seatedAt = open.seated_at;
      }
    } catch (err) {
      if (err instanceof Error && err.message === "pos_table_multiple_open_sessions") {
        throw new Error("pos_table_multiple_open_sessions");
      }
      throw err;
    }
  }

  const payStockLines = await resolvePayStockScopedLines({
    lines: input.catalogLines,
    organizationId: input.organizationId,
    outletId: input.outletId,
    sessionId,
  });

  await assertStockForPayLines({
    lines: payStockLines,
    outletId: input.outletId,
  });

  const posShiftId = await resolvePosShiftForPay({
    organizationId: input.organizationId,
    outletId: input.outletId,
  });

  const ensured = await ensurePosCheckoutLead({
    organizationId: input.organizationId,
    phone: input.clientPhone,
    clientName: input.clientName,
    userId: user?.id ?? null,
  });
  const leadId = ensured.leadId;

  const tableDurationMinutes = seatedAt ? durationMinutesSince(seatedAt) : null;

  const checkout: BuildPendingCheckoutPayloadArgs = {
    orgId: input.organizationId,
    leadId,
    clientName: input.clientName,
    clientPhone: input.clientPhone,
    createdBy: user?.id ?? null,
    paymentMethod: "qris",
    paymentChannelId: input.paymentChannelId ?? null,
    outletId: input.outletId,
    salesTypeId: input.salesTypeId,
    posShiftId,
    tableNumber: input.tableNumber,
    posTableId: input.posTableId,
    tableDurationMinutes,
    servedByUserId: input.servedByUserId,
    checkoutTotals: input.paidCatalogTotals,
    lines: input.catalogLines,
    sessionId,
    keepSessionOpen: input.keepSessionOpen,
    remainderCartLines: input.remainderCartLines,
  };

  return { checkout, leadId, posShiftId, boundByPhone: ensured.boundByPhone };
}
